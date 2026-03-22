import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

console.log("Export Bookings Function Started");

// Field mapping for readable names
const FIELD_MAP: Record<number, { name: string; size: string; price_pre: number; price_post: number }> = {
  1: { name: 'สนาม 1', size: '5 คน', price_pre: 500, price_post: 700 },
  2: { name: 'สนาม 2', size: '5 คน', price_pre: 500, price_post: 700 },
  3: { name: 'สนาม 3', size: '7-8 คน', price_pre: 1000, price_post: 1200 },
  4: { name: 'สนาม 4', size: '7 คน', price_pre: 800, price_post: 1000 },
  5: { name: 'สนาม 5', size: '7 คน', price_pre: 800, price_post: 1000 },
  6: { name: 'สนาม 6', size: '7 คน (ใหม่)', price_pre: 1000, price_post: 1200 },
};

// Calculate full price based on time range and field
function calculateFullPrice(fieldNo: number, timeFrom: string, timeTo: string): number {
  const field = FIELD_MAP[fieldNo];
  if (!field) return 0;

  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const sMins = toMins(timeFrom);
  const eMins = toMins(timeTo);
  if (eMins <= sMins) return 0;

  const cutoff = 18 * 60;
  const preHours = Math.max(0, Math.min(eMins, cutoff) - sMins) / 60;
  const postHours = Math.max(0, eMins - Math.max(sMins, cutoff)) / 60;

  let prePrice = preHours * field.price_pre;
  let postPrice = postHours * field.price_post;
  if (prePrice > 0 && prePrice % 100 !== 0) prePrice = Math.ceil(prePrice / 100) * 100;
  if (postPrice > 0 && postPrice % 100 !== 0) postPrice = Math.ceil(postPrice / 100) * 100;

  return Math.round(prePrice + postPrice);
}

// Escape CSV field (handle commas, quotes, newlines)
function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { dateFrom, dateTo } = body;

    if (!dateFrom || !dateTo) {
      return new Response(JSON.stringify({ error: 'dateFrom and dateTo are required (YYYY-MM-DD)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Export] Fetching bookings from ${dateFrom} to ${dateTo}`);

    // 1. Fetch bookings in date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date')
      .order('time_from');

    if (bookingsError) throw bookingsError;
    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ error: 'ไม่พบข้อมูลในช่วงวันที่ที่เลือก', count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Export] Found ${bookings.length} bookings`);

    const bookingIds = bookings.map(b => b.booking_id || b.id).filter(Boolean);
    const userIds = bookings.map(b => b.user_id).filter(Boolean);

    // 2. Fetch profiles (batch)
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const uniqueUserIds = [...new Set(userIds)];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, team_name, phone_number, points')
        .in('user_id', uniqueUserIds);
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.user_id] = p; });
      }
    }

    // 3. Fetch user_coupons + campaigns (V2 coupons)
    let couponsMap: Record<string, any> = {};
    if (bookingIds.length > 0) {
      const { data: coupons } = await supabase
        .from('user_coupons')
        .select(`
          booking_id,
          campaigns (
            name,
            coupon_type,
            benefit_type,
            discount_amount,
            discount_percent
          )
        `)
        .in('booking_id', bookingIds)
        .eq('status', 'USED');

      if (coupons) {
        coupons.forEach((c: any) => {
          if (c.booking_id && c.campaigns) {
            couponsMap[c.booking_id] = c.campaigns;
          }
        });
      }
    }

    // 4. Fetch promo_codes (V1)
    let promoCodesMap: Record<string, any> = {};
    if (bookingIds.length > 0) {
      const { data: promos } = await supabase
        .from('promo_codes')
        .select('booking_id, code, discount_amount, original_price')
        .in('booking_id', bookingIds)
        .eq('status', 'used');

      if (promos) {
        promos.forEach((p: any) => {
          if (p.booking_id) promoCodesMap[p.booking_id] = p;
        });
      }
    }

    // 5. Fetch referrals
    let referralsMap: Record<string, any> = {};
    if (bookingIds.length > 0) {
      // referrals.booking_id is UUID, bookings.id is also UUID
      const bookingUUIDs = bookings.map(b => b.id).filter(Boolean);
      const { data: referrals } = await supabase
        .from('referrals')
        .select('booking_id, status, reward_amount')
        .in('booking_id', bookingUUIDs);

      if (referrals) {
        referrals.forEach((r: any) => {
          if (r.booking_id) referralsMap[r.booking_id] = r;
        });
      }
    }

    // 6. Fetch point_history
    let pointsMap: Record<string, number> = {};
    if (bookingIds.length > 0) {
      // point_history.reference_id stores booking id as text
      const bookingIdStrings = bookings.map(b => String(b.id)).filter(Boolean);
      const { data: points } = await supabase
        .from('point_history')
        .select('reference_id, amount')
        .eq('reference_type', 'booking')
        .in('reference_id', bookingIdStrings);

      if (points) {
        points.forEach((p: any) => {
          if (p.reference_id) pointsMap[p.reference_id] = p.amount;
        });
      }
    }

    console.log(`[Export] Data fetched. Profiles: ${Object.keys(profilesMap).length}, Coupons: ${Object.keys(couponsMap).length}, Promos: ${Object.keys(promoCodesMap).length}, Referrals: ${Object.keys(referralsMap).length}, Points: ${Object.keys(pointsMap).length}`);

    // 7. Build CSV
    const headers = [
      'booking_id',
      'วันที่',
      'เวลาเริ่ม',
      'เวลาจบ',
      'สนาม',
      'ขนาดสนาม',
      'ราคาเต็ม',
      'ส่วนลด',
      'ราคาจ่ายจริง',
      'ชื่อลูกค้า',
      'เบอร์โทร',
      'ชื่อทีม',
      'ช่องทางการจอง',
      'สถานะการจอง',
      'วิธีจ่ายเงิน',
      'สถานะจ่ายเงิน',
      'ใช้โปรโมชั่น',
      'ชื่อแคมเปญ',
      'ประเภทคูปอง',
      'โปรโมโค้ด_V1',
      'มาจากแนะนำเพื่อน',
      'แต้มที่ได้รับ',
      'สถานะการมา',
      'วันที่สร้างรายการ',
    ];

    const rows = bookings.map(b => {
      const bid = b.booking_id || b.id;
      const field = FIELD_MAP[b.field_no] || { name: `สนาม ${b.field_no}`, size: '-', price_pre: 0, price_post: 0 };
      const profile = profilesMap[b.user_id] || {};
      const coupon = couponsMap[bid] || null;
      const promo = promoCodesMap[bid] || null;
      const referral = referralsMap[String(b.id)] || null;
      const pointsEarned = pointsMap[String(b.id)] || 0;

      // Calculate full price for discount calculation
      const fullPrice = calculateFullPrice(b.field_no, b.time_from, b.time_to);
      const actualPrice = b.price_total_thb || 0;
      const discount = Math.max(0, fullPrice - actualPrice);

      // Campaign name
      let campaignName = '';
      let couponType = '';
      if (coupon) {
        campaignName = coupon.name || '';
        couponType = coupon.coupon_type || coupon.benefit_type || '';
      }

      // Promo code V1
      let promoCode = '';
      if (promo) {
        promoCode = promo.code || '';
      }

      // Source mapping
      const sourceMap: Record<string, string> = {
        'admin': 'Admin',
        'line': 'LINE LIFF',
        'line_bot_regular': 'LINE Bot',
      };

      // Status mapping
      const statusMap: Record<string, string> = {
        'confirmed': 'ยืนยันแล้ว',
        'pending_payment': 'รอชำระ',
        'cancelled': 'ยกเลิก',
        'deposit_paid': 'จ่ายมัดจำแล้ว',
      };

      // Payment method mapping
      const paymentMap: Record<string, string> = {
        'cash': 'เงินสด',
        'QR': 'QR/โอน',
        'qr': 'QR/โอน',
        'stripe': 'Stripe',
      };

      return [
        bid,
        b.date,
        b.time_from,
        b.time_to,
        field.name,
        field.size,
        fullPrice,
        discount,
        actualPrice,
        b.display_name || '',
        b.phone_number || profile.phone_number || '',
        profile.team_name || '',
        sourceMap[b.source || b.booking_source || ''] || b.source || b.booking_source || '',
        statusMap[b.status || ''] || b.status || '',
        paymentMap[b.payment_method || ''] || b.payment_method || '',
        b.payment_status || '',
        b.is_promo ? 'ใช่' : 'ไม่',
        campaignName,
        couponType,
        promoCode,
        referral ? 'ใช่' : 'ไม่',
        pointsEarned,
        b.attendance_status || '',
        b.created_at ? new Date(b.created_at).toLocaleString('th-TH') : '',
      ].map(csvEscape);
    });

    // BOM for Excel Thai support + CSV content
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const filename = `bookings_${dateFrom}_to_${dateTo}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('[Export Error]:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
