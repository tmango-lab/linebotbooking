import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Parse Input
        const { userId, schoolName, birthDate, studentCardBase64 } = await req.json();

        console.log(`[Register Affiliate] userId: ${userId}, school: ${schoolName}`);

        if (!userId) {
            throw new Error('User ID is required');
        }
        if (!schoolName) {
            throw new Error('School name is required');
        }
        if (!birthDate) {
            throw new Error('Birth date is required');
        }

        // 3. Check if user already registered as affiliate
        const { data: existingAffiliate } = await supabase
            .from('affiliates')
            .select('user_id, status')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingAffiliate) {
            if (existingAffiliate.status === 'APPROVED') {
                return new Response(
                    JSON.stringify({ error: 'คุณได้รับการอนุมัติเป็นผู้แนะนำแล้ว' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            if (existingAffiliate.status === 'PENDING') {
                return new Response(
                    JSON.stringify({ error: 'คำขอของคุณอยู่ระหว่างรอการอนุมัติ' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            // If REJECTED, allow re-submission
        }

        // 4. Ensure user has at least 1 booking (confirmed or pending)
        const { count, error: countError } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .neq('status', 'cancelled');

        if (countError) {
            console.error('Check booking error:', countError);
            throw new Error('ไม่สามารถตรวจสอบประวัติการจองได้');
        }

        if (!count || count < 1) {
            return new Response(
                JSON.stringify({ error: 'กรุณาจองสนามอย่างน้อย 1 ครั้งก่อนสมัครเป็นผู้แนะนำ' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch profile for phone number (optional now)
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, phone_number')
            .eq('user_id', userId)
            .maybeSingle();

        // 5. Upload Student Card image (if provided as Base64)
        let studentCardUrl: string | null = null;
        if (studentCardBase64) {
            const fileExt = 'jpg';
            const filePath = `student-cards/${userId}_${Date.now()}.${fileExt}`;

            // Decode base64 to Uint8Array
            const binaryStr = atob(studentCardBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            const { error: uploadError } = await supabase.storage
                .from('referral-assets')
                .upload(filePath, bytes, {
                    contentType: `image/${fileExt}`,
                    upsert: true
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error('ไม่สามารถอัปโหลดรูปบัตรนักเรียนได้');
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('referral-assets')
                .getPublicUrl(filePath);

            studentCardUrl = publicUrlData?.publicUrl || null;
        }

        // 6. Generate Referral Code (use phone number for simplicity)
        const referralCode = (profile && profile.phone_number)
            ? `REF-${profile.phone_number.slice(-4)}-${Date.now().toString(36).toUpperCase()}`
            : `REF-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

        // 7. Check active referral program exists
        const { data: activeProgram } = await supabase
            .from('referral_programs')
            .select('id, end_date')
            .eq('is_active', true)
            .maybeSingle();

        if (!activeProgram) {
            return new Response(
                JSON.stringify({ error: 'ไม่มีโปรแกรมแนะนำเพื่อนที่เปิดใช้งานอยู่ในขณะนี้' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if program expired
        if (activeProgram.end_date && new Date(activeProgram.end_date) < new Date()) {
            return new Response(
                JSON.stringify({ error: 'โปรแกรมแนะนำเพื่อนหมดอายุแล้ว' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 8. Upsert Affiliate Record
        const { data: affiliate, error: upsertError } = await supabase
            .from('affiliates')
            .upsert({
                user_id: userId,
                referral_code: referralCode,
                student_card_url: studentCardUrl,
                school_name: schoolName,
                birth_date: birthDate,
                status: 'PENDING',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (upsertError) {
            console.error('Upsert error:', upsertError);
            throw new Error('ไม่สามารถบันทึกข้อมูลได้');
        }

        console.log(`[Register Affiliate] Success: ${userId} -> ${referralCode}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'ส่งคำขอเป็นผู้แนะนำสำเร็จ รอการอนุมัติจากแอดมิน',
                affiliate: {
                    referral_code: referralCode,
                    status: 'PENDING',
                    school_name: schoolName
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[Register Affiliate Error]', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
