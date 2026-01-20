
// supabase/functions/_shared/lineClient.ts

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') || '';

// Basic types for LINE
export interface LineMessage {
    type: string;
    text?: string;
    quickReply?: any;
    [key: string]: any;
}

export interface LineEvent {
    type: string;
    replyToken?: string;
    source: {
        userId: string;
        type: string;
    };
    message?: {
        type: string;
        text: string;
        id: string;
    };
    postback?: {
        data: string;
        params?: any;
    };
    [key: string]: any;
}

/**
 * Reply to a standard webhook event
 */
export async function replyMessage(replyToken: string, messages: LineMessage | LineMessage[]) {
    if (!replyToken) return;
    const msgs = Array.isArray(messages) ? messages : [messages];

    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: msgs,
        }),
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error('LINE Reply Error:', res.status, txt);
    }
}

/**
 * Push message to specific user
 */
export async function pushMessage(to: string, messages: LineMessage | LineMessage[]) {
    if (!to) return;
    const msgs = Array.isArray(messages) ? messages : [messages];

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            to: to,
            messages: msgs,
        }),
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error('LINE Push Error:', res.status, txt);
    }
}

/**
 * Verify LINE Signature (HMAC-SHA256)
 * @param body stringified body
 * @param signature X-Line-Signature header
 * @param secret Channel Secret
 */
export async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
    if (!secret) return true; // dev mode or unsafe

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signed = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
    );

    const hashArray = Array.from(new Uint8Array(signed));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));

    return hashBase64 === signature;
}
