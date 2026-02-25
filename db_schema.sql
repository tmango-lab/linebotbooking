


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_campaign_limit"("p_campaign_id" "uuid", "p_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_count INT;
BEGIN
    -- If no limit is set, strictly speaking the logic calling this should handle it,
    -- but if passed here, unlimited is always true.
    IF p_limit IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Get current count
    SELECT redemption_count INTO current_count
    FROM campaigns
    WHERE id = p_campaign_id;

    -- If campaign not found, assume false (safe fail) or handle err? 
    -- Returning false blocks usage.
    IF current_count IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check
    RETURN current_count < p_limit;
END;
$$;


ALTER FUNCTION "public"."check_campaign_limit"("p_campaign_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_campaign_redemption"("target_campaign_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE campaigns
    SET redemption_count = GREATEST(0, COALESCE(redemption_count, 0) - 1)
    WHERE id = target_campaign_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."decrement_campaign_redemption"("target_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_promo_codes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.promo_codes
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_old_promo_codes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."expire_old_promo_codes"() IS 'Automatically expire codes past their expiry time';



CREATE OR REPLACE FUNCTION "public"."increment_campaign_redemption"("target_campaign_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_count INT;
    max_limit INT;
BEGIN
    -- Select with Row-Level Lock
    SELECT redemption_count, redemption_limit INTO current_count, max_limit
    FROM campaigns
    WHERE id = target_campaign_id
    FOR UPDATE;

    -- Check if limit is reached
    IF max_limit IS NOT NULL AND max_limit > 0 AND current_count >= max_limit THEN
        RETURN FALSE;
    END IF;

    -- Increment
    UPDATE campaigns
    SET redemption_count = COALESCE(redemption_count, 0) + 1
    WHERE id = target_campaign_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."increment_campaign_redemption"("target_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_referral_reward_sql"("p_booking_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
            DECLARE
                v_referral RECORD;
                v_campaign_id UUID;
                v_referrer_id TEXT;
                v_reward_amount NUMERIC;
            BEGIN
                -- 1. Check referral
                SELECT * INTO v_referral FROM public.referrals 
                WHERE booking_id = p_booking_id AND status = 'PENDING_PAYMENT';

                IF NOT FOUND THEN
                    RETURN jsonb_build_object('success', false, 'message', 'No pending referral found');
                END IF;

                v_referrer_id := v_referral.referrer_id;
                v_reward_amount := COALESCE(v_referral.reward_amount, 100);

                -- 2. Find Reward Campaign
                SELECT id INTO v_campaign_id FROM public.campaigns 
                WHERE name = '🎁 รางวัลแนะนำเพื่อน' AND status = 'active' LIMIT 1;

                IF v_campaign_id IS NULL THEN
                    INSERT INTO public.campaigns (name, description, status, discount_amount, start_date, end_date)
                    VALUES ('🎁 รางวัลแนะนำเพื่อน', 'คูปองจากการแนะนำเพื่อน', 'active', v_reward_amount, NOW(), NOW() + INTERVAL '1 year')
                    RETURNING id INTO v_campaign_id;
                END IF;

                -- 3. Create Coupon
                INSERT INTO public.user_coupons (user_id, campaign_id, status, expires_at)
                VALUES (v_referrer_id, v_campaign_id, 'ACTIVE', NOW() + INTERVAL '3 months');

                -- 4. Update Referral Status
                UPDATE public.referrals SET status = 'COMPLETED', updated_at = NOW()
                WHERE id = v_referral.id;

                -- 5. Update Request Stats
                UPDATE public.affiliates SET 
                    total_referrals = (SELECT COUNT(*) FROM public.referrals WHERE referrer_id = v_referrer_id AND status = 'COMPLETED'),
                    total_earnings = (SELECT TRUNC(COALESCE(SUM(reward_amount), 0)) FROM public.referrals WHERE referrer_id = v_referrer_id AND status = 'COMPLETED'),
                    updated_at = NOW()
                WHERE user_id = v_referrer_id;

                RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'reward_amount', v_reward_amount);
            END;
            $$;


ALTER FUNCTION "public"."process_referral_reward_sql"("p_booking_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."affiliates" (
    "user_id" "text" NOT NULL,
    "referral_code" "text" NOT NULL,
    "student_card_url" "text",
    "school_name" "text",
    "birth_date" "date",
    "status" "text" DEFAULT 'PENDING'::"text",
    "total_earnings" numeric DEFAULT 0,
    "total_referrals" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "affiliates_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."affiliates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "text",
    "user_id" "text",
    "display_name" "text",
    "field_no" integer,
    "date" "date" NOT NULL,
    "time_from" time without time zone NOT NULL,
    "time_to" time without time zone NOT NULL,
    "duration_h" numeric(3,1) NOT NULL,
    "crosses_18" boolean DEFAULT false,
    "price_total_thb" integer NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text",
    "hold_expires_at" timestamp with time zone,
    "confirmed_by" "text",
    "cancelled_by" "text",
    "cancel_reason" "text",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "admin_note" "text",
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'admin'::"text",
    "is_promo" boolean DEFAULT false,
    "phone_number" "text",
    "is_refunded" boolean DEFAULT false,
    "timeout_at" timestamp with time zone,
    "payment_method" "text",
    "payment_status" "text",
    "payment_slip_url" "text",
    "booking_source" "text" DEFAULT 'line'::"text",
    "attendance_status" "text",
    "attendance_updated_at" timestamp with time zone,
    "stripe_payment_intent_id" "text",
    CONSTRAINT "bookings_attendance_status_check" CHECK (("attendance_status" = ANY (ARRAY['confirmed'::"text", 'cancel_requested'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."source" IS 'Source of the booking: line, admin, or import';



COMMENT ON COLUMN "public"."bookings"."is_promo" IS 'Whether the booking used a promo code';



COMMENT ON COLUMN "public"."bookings"."is_refunded" IS 'Flag to indicate if the booking payment has been refunded to the customer';



COMMENT ON COLUMN "public"."bookings"."booking_source" IS 'Source of the booking: line, admin, line_bot_regular, etc.';



COMMENT ON COLUMN "public"."bookings"."attendance_status" IS 'Status of user attendance confirmation (confirmed, cancel_requested)';



CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "coupon_type" "text" DEFAULT 'main'::"text",
    "benefit_type" "text",
    "benefit_value" "jsonb",
    "total_quantity" integer,
    "remaining_quantity" integer,
    "limit_per_user" integer DEFAULT 1,
    "secret_codes" "text"[],
    "conditions" "jsonb",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "eligible_fields" integer[],
    "payment_methods" "text"[],
    "image_url" "text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "allowed_time_range" "jsonb",
    "duration_days" integer,
    "is_public" boolean DEFAULT false,
    "min_spend" integer DEFAULT 0,
    "valid_time_start" time without time zone,
    "valid_time_end" time without time zone,
    "eligible_days" "text"[],
    "reward_item" "text",
    "description" "text",
    "discount_amount" numeric DEFAULT 0,
    "discount_percent" numeric DEFAULT 0,
    "is_stackable" boolean DEFAULT false,
    "redemption_limit" integer,
    "redemption_count" integer DEFAULT 0,
    "max_discount" integer,
    "allow_ontop_stacking" boolean DEFAULT true,
    CONSTRAINT "campaigns_benefit_type_check" CHECK (("benefit_type" = ANY (ARRAY['DISCOUNT'::"text", 'REWARD'::"text"]))),
    CONSTRAINT "campaigns_coupon_type_check" CHECK (("coupon_type" = ANY (ARRAY['main'::"text", 'ontop'::"text", 'MAIN'::"text", 'ONTOP'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


COMMENT ON COLUMN "public"."campaigns"."coupon_type" IS 'Type of coupon: main or ontop';



COMMENT ON COLUMN "public"."campaigns"."eligible_fields" IS 'List of Field IDs (1-6) that this campaign applies to. NULL = All Fields';



COMMENT ON COLUMN "public"."campaigns"."payment_methods" IS 'List of allowed payment methods. NULL = All Methods';



COMMENT ON COLUMN "public"."campaigns"."is_public" IS 'If true, shows in public coupon list. If false, requires secret code or direct link.';



COMMENT ON COLUMN "public"."campaigns"."min_spend" IS 'Minimum booking price required to use this coupon';



COMMENT ON COLUMN "public"."campaigns"."valid_time_start" IS 'Start time for coupon validity (HH:MM)';



COMMENT ON COLUMN "public"."campaigns"."valid_time_end" IS 'End time for coupon validity (HH:MM)';



COMMENT ON COLUMN "public"."campaigns"."eligible_days" IS 'List of eligible days of week (Mon,Tue,Wed,Thu,Fri,Sat,Sun). NULL = All Days';



COMMENT ON COLUMN "public"."campaigns"."reward_item" IS 'Description of free item if benefit type is Reward';



COMMENT ON COLUMN "public"."campaigns"."description" IS 'Campaign description shown to users';



COMMENT ON COLUMN "public"."campaigns"."discount_amount" IS 'Fixed discount amount in THB';



COMMENT ON COLUMN "public"."campaigns"."discount_percent" IS 'Percentage discount (0-100)';



COMMENT ON COLUMN "public"."campaigns"."is_stackable" IS 'Whether this coupon can be stacked with others';



COMMENT ON COLUMN "public"."campaigns"."redemption_limit" IS 'Limit number of successful redemptions (e.g. 5 prizes). Null = Unlimited.';



COMMENT ON COLUMN "public"."campaigns"."redemption_count" IS 'Current number of successful redemptions.';



COMMENT ON COLUMN "public"."campaigns"."max_discount" IS 'Maximum discount amount in THB for percentage coupons. NULL = no cap.';



CREATE TABLE IF NOT EXISTS "public"."fields" (
    "id" integer NOT NULL,
    "label" "text" NOT NULL,
    "type" "text" NOT NULL,
    "matchday_court_id" integer,
    "active" boolean DEFAULT true,
    "price_pre" integer NOT NULL,
    "price_post" integer NOT NULL
);


ALTER TABLE "public"."fields" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fields_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fields_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fields_id_seq" OWNED BY "public"."fields"."id";



CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone,
    "user_id" "text",
    "source_type" "text",
    "event_type" "text",
    "action" "text",
    "step" "text",
    "label" "text",
    "message_text" "text",
    "postback_data" "text",
    "process_ms" integer,
    "extra_json" "jsonb",
    "date_int" integer
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


ALTER TABLE "public"."logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."manual_promo_codes" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "min_price" numeric(10,2) DEFAULT 0,
    "max_discount" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "usage_limit" integer DEFAULT 0,
    "usage_count" integer DEFAULT 0,
    CONSTRAINT "manual_promo_codes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "manual_promo_codes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."manual_promo_codes" OWNER TO "postgres";


ALTER TABLE "public"."manual_promo_codes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."manual_promo_codes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "text" NOT NULL,
    "team_name" "text",
    "phone_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tags" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_campaigns" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "discount_type" character varying(10) NOT NULL,
    "discount_value" numeric NOT NULL,
    "min_spent" numeric DEFAULT 0,
    "max_discount" numeric,
    "total_quota" integer DEFAULT 100,
    "used_count" integer DEFAULT 0,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "eligible_fields" integer[],
    "keyword" character varying(50),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "text",
    CONSTRAINT "promo_campaigns_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."promo_campaigns" OWNER TO "postgres";


ALTER TABLE "public"."promo_campaigns" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."promo_campaigns_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" bigint NOT NULL,
    "code" character varying(6) NOT NULL,
    "user_id" "text" NOT NULL,
    "field_id" integer NOT NULL,
    "booking_date" "date" NOT NULL,
    "time_from" time without time zone NOT NULL,
    "time_to" time without time zone NOT NULL,
    "duration_h" numeric NOT NULL,
    "original_price" numeric NOT NULL,
    "discount_type" character varying(10) NOT NULL,
    "discount_value" numeric NOT NULL,
    "discount_amount" numeric NOT NULL,
    "final_price" numeric NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "used_at" timestamp with time zone,
    "used_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "booking_id" "text",
    "notes" "text",
    CONSTRAINT "positive_prices" CHECK ((("original_price" > (0)::numeric) AND ("discount_amount" >= (0)::numeric) AND ("final_price" >= (0)::numeric))),
    CONSTRAINT "valid_discount_type" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::"text"[]))),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'used'::character varying, 'expired'::character varying])::"text"[])))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."promo_codes" IS 'Promotional discount codes for LINE chatbot users';



COMMENT ON COLUMN "public"."promo_codes"."code" IS 'Unique 6-digit promotional code';



COMMENT ON COLUMN "public"."promo_codes"."discount_type" IS 'Type of discount: percent or fixed amount';



COMMENT ON COLUMN "public"."promo_codes"."status" IS 'Code status: active, used, or expired';



CREATE SEQUENCE IF NOT EXISTS "public"."promo_codes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."promo_codes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."promo_codes_id_seq" OWNED BY "public"."promo_codes"."id";



CREATE TABLE IF NOT EXISTS "public"."promo_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "enabled" boolean DEFAULT true,
    "discount_type" character varying(10) DEFAULT 'percent'::character varying,
    "discount_value" numeric DEFAULT 10,
    "min_booking_price" numeric DEFAULT 500,
    "expiry_minutes" integer DEFAULT 30,
    "daily_limit_per_user" integer DEFAULT 2,
    "reuse_window_hours" integer DEFAULT 2,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "text",
    CONSTRAINT "single_row" CHECK (("id" = 1)),
    CONSTRAINT "valid_discount_type" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."promo_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."promo_settings" IS 'Global configuration for promo code system (single row)';



CREATE TABLE IF NOT EXISTS "public"."referral_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT false,
    "reward_amount" numeric DEFAULT 100 NOT NULL,
    "discount_percent" numeric DEFAULT 50 NOT NULL,
    "start_date" timestamp with time zone DEFAULT "now"(),
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."referral_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_id" "text" NOT NULL,
    "referee_id" "text" NOT NULL,
    "booking_id" "text" NOT NULL,
    "program_id" "uuid",
    "status" "text" DEFAULT 'PENDING_PAYMENT'::"text",
    "reward_amount" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "referrals_status_check" CHECK (("status" = ANY (ARRAY['PENDING_PAYMENT'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" bigint NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"(),
    "user_id" "text",
    "source_type" "text",
    "event_type" "text",
    "action" "text",
    "step" "text",
    "label" "text",
    "message_text" "text",
    "postback_data" "text",
    "process_ms" integer,
    "extra_json" "jsonb"
);


ALTER TABLE "public"."system_logs" OWNER TO "postgres";


ALTER TABLE "public"."system_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."system_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "campaign_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "booking_id" "text",
    CONSTRAINT "user_coupons_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'USED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."user_coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_state" (
    "user_id" "text" NOT NULL,
    "date" "date",
    "time_from" "text",
    "duration_h" numeric(3,1),
    "field_no" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "state_data" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_states" (
    "user_id" "text" NOT NULL,
    "selected_date" "date",
    "selected_time" time without time zone,
    "duration_h" numeric,
    "field_no" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_vouchers" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "campaign_id" bigint,
    "status" character varying(20) DEFAULT 'available'::character varying,
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "booking_id" "text",
    CONSTRAINT "user_vouchers_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['available'::character varying, 'used'::character varying, 'expired'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_vouchers" OWNER TO "postgres";


ALTER TABLE "public"."user_vouchers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_vouchers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."fields" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fields_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."promo_codes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."promo_codes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fields"
    ADD CONSTRAINT "fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_promo_codes"
    ADD CONSTRAINT "manual_promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."manual_promo_codes"
    ADD CONSTRAINT "manual_promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."promo_campaigns"
    ADD CONSTRAINT "promo_campaigns_keyword_key" UNIQUE ("keyword");



ALTER TABLE ONLY "public"."promo_campaigns"
    ADD CONSTRAINT "promo_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_settings"
    ADD CONSTRAINT "promo_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_programs"
    ADD CONSTRAINT "referral_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_id_key" UNIQUE ("referee_id");



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_coupons"
    ADD CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_state"
    ADD CONSTRAINT "user_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_states"
    ADD CONSTRAINT "user_states_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_vouchers"
    ADD CONSTRAINT "user_vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_vouchers"
    ADD CONSTRAINT "user_vouchers_user_id_campaign_id_key" UNIQUE ("user_id", "campaign_id");



CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("date");



CREATE INDEX "idx_bookings_stripe_pi" ON "public"."bookings" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_campaigns_status" ON "public"."campaigns" USING "btree" ("status");



CREATE INDEX "idx_promo_campaigns_dates" ON "public"."promo_campaigns" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_promo_campaigns_keyword" ON "public"."promo_campaigns" USING "btree" ("keyword");



CREATE INDEX "idx_promo_code" ON "public"."promo_codes" USING "btree" ("code");



CREATE INDEX "idx_promo_created" ON "public"."promo_codes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_promo_expires" ON "public"."promo_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_promo_status" ON "public"."promo_codes" USING "btree" ("status");



CREATE INDEX "idx_promo_user_date" ON "public"."promo_codes" USING "btree" ("user_id", "booking_date");



CREATE INDEX "idx_user_coupons_user_id" ON "public"."user_coupons" USING "btree" ("user_id");



CREATE INDEX "idx_user_vouchers_user_id" ON "public"."user_vouchers" USING "btree" ("user_id");



CREATE INDEX "profiles_tags_idx" ON "public"."profiles" USING "gin" ("tags");



CREATE OR REPLACE TRIGGER "update_promo_campaigns_updated_at" BEFORE UPDATE ON "public"."promo_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_field_no_fkey" FOREIGN KEY ("field_no") REFERENCES "public"."fields"("id");



ALTER TABLE ONLY "public"."manual_promo_codes"
    ADD CONSTRAINT "manual_promo_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");



ALTER TABLE ONLY "public"."user_coupons"
    ADD CONSTRAINT "user_coupons_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_vouchers"
    ADD CONSTRAINT "user_vouchers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."promo_campaigns"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update affiliate status" ON "public"."affiliates" FOR UPDATE USING (true);



CREATE POLICY "Admins can update programs" ON "public"."referral_programs" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can view all affiliate data" ON "public"."affiliates" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated delete" ON "public"."campaigns" FOR DELETE USING (true);



CREATE POLICY "Allow authenticated full access" ON "public"."manual_promo_codes" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated insert" ON "public"."campaigns" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow authenticated read promo_codes" ON "public"."promo_codes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read promo_settings" ON "public"."promo_settings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated update" ON "public"."campaigns" FOR UPDATE USING (true);



CREATE POLICY "Allow authenticated update promo_codes" ON "public"."promo_codes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated update promo_settings" ON "public"."promo_settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."campaigns" FOR SELECT USING (true);



CREATE POLICY "Allow service role full access" ON "public"."campaigns" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role full access" ON "public"."manual_promo_codes" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role manage promo_codes" ON "public"."promo_codes" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role update promo_settings" ON "public"."promo_settings" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Enable all operations for service role" ON "public"."bookings" USING (true) WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated" ON "public"."referrals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for everyone" ON "public"."affiliates" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read for everyone" ON "public"."affiliates" FOR SELECT USING (true);



CREATE POLICY "Enable read for everyone" ON "public"."referral_programs" FOR SELECT USING (true);



CREATE POLICY "Enable read for everyone" ON "public"."referrals" FOR SELECT USING (true);



CREATE POLICY "Enable read/write for all users" ON "public"."logs" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."promo_campaigns" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."promo_codes" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."promo_settings" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."user_states" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read/write for all users" ON "public"."user_vouchers" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for everyone" ON "public"."affiliates" FOR UPDATE USING (true);



CREATE POLICY "Enable update for service role" ON "public"."referrals" FOR UPDATE USING (true);



CREATE POLICY "Everyone can read active programs" ON "public"."referral_programs" FOR SELECT USING (true);



CREATE POLICY "Public fields are viewable by everyone" ON "public"."fields" FOR SELECT USING (true);



CREATE POLICY "Referrers can see their referrals" ON "public"."referrals" FOR SELECT USING (("referrer_id" = ("auth"."uid"())::"text"));



CREATE POLICY "System can manage referrals" ON "public"."referrals" USING (true);



CREATE POLICY "Users can insert own affiliate request" ON "public"."affiliates" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can read own affiliate data" ON "public"."affiliates" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view own coupons" ON "public"."user_coupons" FOR SELECT USING (true);



ALTER TABLE "public"."affiliates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manual_promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_vouchers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."check_campaign_limit"("p_campaign_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_campaign_limit"("p_campaign_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_campaign_limit"("p_campaign_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_campaign_redemption"("target_campaign_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_campaign_redemption"("target_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_campaign_redemption"("target_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_promo_codes"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_promo_codes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_promo_codes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_campaign_redemption"("target_campaign_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_campaign_redemption"("target_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_campaign_redemption"("target_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_referral_reward_sql"("p_booking_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_referral_reward_sql"("p_booking_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_referral_reward_sql"("p_booking_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."affiliates" TO "anon";
GRANT ALL ON TABLE "public"."affiliates" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliates" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."fields" TO "anon";
GRANT ALL ON TABLE "public"."fields" TO "authenticated";
GRANT ALL ON TABLE "public"."fields" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fields_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fields_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fields_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."manual_promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."manual_promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_promo_codes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manual_promo_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."manual_promo_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manual_promo_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."promo_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_campaigns" TO "service_role";



GRANT ALL ON SEQUENCE "public"."promo_campaigns_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."promo_campaigns_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."promo_campaigns_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."promo_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."promo_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."promo_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promo_settings" TO "anon";
GRANT ALL ON TABLE "public"."promo_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_settings" TO "service_role";



GRANT ALL ON TABLE "public"."referral_programs" TO "anon";
GRANT ALL ON TABLE "public"."referral_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_programs" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_coupons" TO "anon";
GRANT ALL ON TABLE "public"."user_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."user_coupons" TO "service_role";



GRANT ALL ON TABLE "public"."user_state" TO "anon";
GRANT ALL ON TABLE "public"."user_state" TO "authenticated";
GRANT ALL ON TABLE "public"."user_state" TO "service_role";



GRANT ALL ON TABLE "public"."user_states" TO "anon";
GRANT ALL ON TABLE "public"."user_states" TO "authenticated";
GRANT ALL ON TABLE "public"."user_states" TO "service_role";



GRANT ALL ON TABLE "public"."user_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."user_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_vouchers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_vouchers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_vouchers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_vouchers_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































