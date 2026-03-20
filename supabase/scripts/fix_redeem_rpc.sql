CREATE OR REPLACE FUNCTION "public"."redeem_points_for_campaign"("p_user_id" "text", "p_campaign_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_campaign_record RECORD;
    v_user_balance INT;
    v_new_balance INT;
    v_inserted_coupon_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- ก. ล็อคและดึงข้อมูลแคมเปญขึ้นมาตรวจสอบ
    SELECT id, point_cost, remaining_quantity, limit_per_user, status, end_date, duration_days
    INTO v_campaign_record
    FROM public.campaigns
    WHERE id = p_campaign_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'ไม่พบแคมเปญนี้');
    END IF;

    -- ข. ตรวจสอบเงื่อนไขคูปองเบื้องต้น
    IF v_campaign_record.status != 'active' OR (v_campaign_record.end_date IS NOT NULL AND v_campaign_record.end_date < now()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'คูปองนี้หมดอายุหรือถูกระงับไปแล้ว');
    END IF;

    IF v_campaign_record.remaining_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'คูปองนี้ถูกแลกครบจำนวนแล้ว');
    END IF;

    -- ค. ล็อคและเช็คว่าโควตาการแลกของ User คนนี้เต็มหรือยัง (เช่นให้แลกได้คนละใบ)
    IF v_campaign_record.limit_per_user > 0 THEN
        IF (SELECT count(*) FROM public.user_coupons WHERE user_id = p_user_id AND campaign_id = p_campaign_id) >= v_campaign_record.limit_per_user THEN
            RETURN jsonb_build_object('success', false, 'error', 'คุณถึงขีดจำกัดการแลกคูปองนี้แล้ว');
        END IF;
    END IF;

    -- ง. ถ้าคูปองนี้ต้องใช้แต้มแลก -> เข้าสู่โหมดหักแต้ม
    IF v_campaign_record.point_cost > 0 THEN
        -- ล็อคและเช็คยอดแต้มคงเหลือของ User
        SELECT points INTO v_user_balance
        FROM public.profiles
        WHERE user_id = p_user_id FOR UPDATE;

        IF v_user_balance < v_campaign_record.point_cost THEN
            RETURN jsonb_build_object('success', false, 'error', 'แต้มสะสมไม่เพียงพอสำหรับการแลก (ต้องใช้ ' || v_campaign_record.point_cost || ' แต้ม)');
        END IF;

        -- หักแต้ม!
        UPDATE public.profiles
        SET points = points - v_campaign_record.point_cost
        WHERE user_id = p_user_id
        RETURNING points INTO v_new_balance;

        -- บันทึกประวัติการหักแต้ม
        INSERT INTO public.point_history (
            user_id, amount, balance_after, transaction_type, description, reference_type, reference_id
        ) VALUES (
            p_user_id, -v_campaign_record.point_cost, v_new_balance, 'REDEEM_COUPON', 
            'ใช้แต้มแลกคูปอง', 'campaign', p_campaign_id::text
        );
    END IF;

    -- จ. คํานวณวันหมดอายุของคูปอง (expires_at)
    IF v_campaign_record.duration_days IS NOT NULL AND v_campaign_record.duration_days > 0 THEN
        v_expires_at := now() + (v_campaign_record.duration_days || ' days')::interval;
    ELSE
        -- หากไม่มี duration_days ให้ถือว่าหมดอายุตาม end_date ของแคมเปญ หรือให้มีอายุ 30 วัน ถ้าไม่ได้ตั้ง
        v_expires_at := COALESCE(v_campaign_record.end_date, now() + interval '30 days');
    END IF;

    -- ฉ. แจกคูปองเข้า Wallet พร้อบหักโควตาแคมเปญ
    INSERT INTO public.user_coupons (user_id, campaign_id, status, expires_at)
    VALUES (p_user_id, p_campaign_id, 'ACTIVE', v_expires_at)
    RETURNING id INTO v_inserted_coupon_id;

    UPDATE public.campaigns
    SET remaining_quantity = remaining_quantity - 1
    WHERE id = p_campaign_id;

    -- ส่งคืนผลลัพธ์สำเร็จ
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'แลกคูปองสำเร็จ', 
        'coupon_id', v_inserted_coupon_id,
        'points_spent', v_campaign_record.point_cost,
        'points_remaining', v_new_balance
    );

EXCEPTION WHEN OTHERS THEN
    -- กรณีเกิดข้อผิดพลาดรุนแรง ระบบจะทำ Rollback ค่าแต้มและคูปองโดยอัตโนมัติ ไม่ต้องห่วงของหาย
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
