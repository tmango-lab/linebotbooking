// supabase/functions/_shared/pricingService.ts
import { getActiveFields } from './bookingService.ts';

/**
 * Calculate detailed price for a booking
 */
export async function calculatePrice(fieldId: number, startStr: string, durationH: number): Promise<number> {
    // 1. Get Field Price Info
    const fields = await getActiveFields();

    if (!fields || fields.length === 0) {
        console.error('No active fields available for pricing');
        return 0;
    }

    // Manual find or separate DB call. Optimization: Pass field object if available.
    const field = fields.find((f: any) => f.id === fieldId);

    if (!field) {
        console.error(`Field ${fieldId} not found for pricing`);
        return 0;
    }

    const pricePre = field.price_pre;
    const pricePost = field.price_post;

    // 2. Parse Times
    // startStr = "17:00"
    const [startH, startM] = startStr.split(':').map(Number);

    // Convert everything to decimal hours for easier math
    const startDec = startH + (startM / 60);
    const endDec = startDec + durationH;

    const cutOff = 18.0; // 18:00

    let preHours = 0;
    let postHours = 0;

    // 3. Split Duration
    if (endDec <= cutOff) {
        // Entirely Pre-18
        preHours = durationH;
    } else if (startDec >= cutOff) {
        // Entirely Post-18
        postHours = durationH;
    } else {
        // Crosses 18:00
        preHours = cutOff - startDec;
        postHours = endDec - cutOff;
    }

    // 4. Calculate
    const costPre = preHours * pricePre;

    // Post-18 Rounding Logic: Round up to nearest 100
    // Logic: raw = 0.5 * 700 = 350 -> 400
    const rawPost = postHours * pricePost;
    const costPost = Math.ceil(rawPost / 100) * 100;

    const total = costPre + costPost;

    // Debug Log
    console.log(`Pricing F${fieldId} ${startStr} (${durationH}h) -> Pre:${preHours}h(${costPre}) + Post:${postHours}h(${rawPost}->${costPost}) = ${total}`);

    return total;
}
