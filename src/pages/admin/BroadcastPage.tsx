import { useState, useMemo } from 'react';
import { Send, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Plus, Trash2, Radio } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateType = 'flash_deal' | 'simple_message' | 'custom_json';
type AudienceMode = 'broadcast' | 'multicast';

interface TimeSlot {
    startTime: string;
    endTime: string;
}

const FIELD_COLORS: Record<number, string> = {
    1: '#e11d48', 2: '#ea580c', 3: '#d97706',
    4: '#16a34a', 5: '#0284c7', 6: '#7c3aed'
};

const LIFF_ID = '2009013698-RcmHMN8h';
const LIFF_BASE = `https://liff.line.me/${LIFF_ID}`;

// ─── Flex Builders ───────────────────────────────────────────────────────────

function buildFlashDealCarousel(
    fieldId: number,
    fieldName: string,
    slots: TimeSlot[],
    promoCode: string,
    date: string
) {
    const color = FIELD_COLORS[fieldId] || '#334155';
    const bubbles = slots.map((slot) => ({
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: color,
            paddingTop: '15px',
            paddingBottom: '15px',
            paddingStart: '20px',
            contents: [{
                type: 'text',
                text: '🔥 FLASH DEAL วันนี้เท่านั้น!',
                color: '#ffffff',
                weight: 'bold',
                size: 'sm'
            }]
        },
        hero: {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&auto=format&fit=crop',
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover'
        },
        body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '20px',
            contents: [
                { type: 'text', text: fieldName, weight: 'bold', size: 'xl' },
                {
                    type: 'text',
                    text: `${slot.startTime} - ${slot.endTime} น.`,
                    size: 'lg',
                    color: '#16a34a',
                    weight: 'bold',
                    margin: 'sm'
                },
                ...(promoCode ? [{
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [{
                        type: 'text',
                        text: `🎟️ โค้ด: ${promoCode}`,
                        size: 'sm',
                        color: '#64748b',
                        wrap: true
                    }]
                }] : []),
                ...(date ? [{
                    type: 'text',
                    text: `📅 ${date}`,
                    size: 'sm',
                    color: '#94a3b8',
                    margin: 'sm'
                }] : [])
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '20px',
            paddingTop: '0px',
            contents: [{
                type: 'button',
                style: 'primary',
                color: color,
                action: {
                    type: 'uri',
                    label: `จองคิว ${slot.startTime} เลย!`,
                    uri: `${LIFF_BASE}/?fieldId=${fieldId}&startTime=${slot.startTime}&endTime=${slot.endTime}${date ? `&date=${date}` : ''}`
                }
            }]
        }
    }));

    return {
        type: 'flex',
        altText: `🔥 Flash Deal ${fieldName} - ${slots.map(s => s.startTime).join(', ')}`,
        contents: { type: 'carousel', contents: bubbles }
    };
}

function buildSimpleMessage(header: string, body: string, buttonLabel: string, buttonUrl: string, bgColor: string) {
    return {
        type: 'flex',
        altText: header || 'ข้อความพิเศษจากสนาม',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: bgColor || '#1e293b',
                paddingAll: '20px',
                contents: [{
                    type: 'text',
                    text: header || 'ข้อความพิเศษ',
                    color: '#ffffff',
                    weight: 'bold',
                    size: 'xl',
                    wrap: true
                }]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                contents: [{
                    type: 'text',
                    text: body || 'รายละเอียดเพิ่มเติม',
                    size: 'md',
                    color: '#374151',
                    wrap: true
                }]
            },
            footer: buttonLabel && buttonUrl ? {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                paddingTop: '0',
                contents: [{
                    type: 'button',
                    style: 'primary',
                    color: bgColor || '#1e293b',
                    action: { type: 'uri', label: buttonLabel, uri: buttonUrl }
                }]
            } : undefined
        }
    };
}

// ─── Preview Component ────────────────────────────────────────────────────────

function FlexPreviewCard({ message }: { message: any }) {
    try {
        const bubble = message?.contents?.type === 'carousel'
            ? message.contents.contents[0]
            : message?.contents;

        if (!bubble) return <div className="text-gray-400 text-sm italic text-center py-8">กรอกข้อมูลเพื่อดูตัวอย่าง</div>;

        const headerBg = bubble.header?.backgroundColor || '#1e293b';
        const headerText = bubble.header?.contents?.[0]?.text || '';
        const heroUrl = bubble.hero?.url;
        const bodyContents = bubble.body?.contents || [];
        const footerBtn = bubble.footer?.contents?.[0];

        return (
            <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200 max-w-xs mx-auto text-sm font-sans">
                {/* Header */}
                <div className="px-4 py-3" style={{ backgroundColor: headerBg }}>
                    <p className="text-white font-bold text-xs">{headerText}</p>
                </div>
                {/* Hero */}
                {heroUrl && (
                    <img src={heroUrl} alt="hero" className="w-full object-cover" style={{ aspectRatio: '20/13' }} />
                )}
                {/* Body */}
                <div className="px-4 py-4 space-y-1 bg-white">
                    {bodyContents.map((c: any, i: number) => {
                        if (c.type === 'text') return (
                            <p key={i} className={`${c.weight === 'bold' ? 'font-bold' : ''}`}
                                style={{ color: c.color || '#111', fontSize: c.size === 'xl' ? 18 : c.size === 'lg' ? 15 : 12 }}>
                                {c.text}
                            </p>
                        );
                        if (c.type === 'box') return (
                            <div key={i} className="mt-1">
                                {c.contents?.map((cc: any, j: number) => (
                                    <p key={j} style={{ color: cc.color || '#555', fontSize: 11 }}>{cc.text}</p>
                                ))}
                            </div>
                        );
                        return null;
                    })}
                </div>
                {/* Footer */}
                {footerBtn && (
                    <div className="px-4 pb-4 bg-white">
                        <div className="w-full py-2.5 rounded-lg text-center text-white text-xs font-bold cursor-pointer"
                            style={{ backgroundColor: footerBtn.color || '#16a34a' }}>
                            {footerBtn.action?.label || 'คลิก'}
                        </div>
                    </div>
                )}
                {message?.contents?.type === 'carousel' && message.contents.contents.length > 1 && (
                    <div className="bg-gray-50 text-center py-2 text-xs text-gray-400">
                        + อีก {message.contents.contents.length - 1} สล็อต (เลื่อนดูได้)
                    </div>
                )}
            </div>
        );
    } catch {
        return <div className="text-red-400 text-sm text-center py-4">Preview Error</div>;
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BroadcastPage() {
    // Template
    const [template, setTemplate] = useState<TemplateType>('flash_deal');

    // Flash Deal fields
    const [fieldId, setFieldId] = useState<number>(6);
    const [fieldName, setFieldName] = useState('สนาม 6');
    const [slots, setSlots] = useState<TimeSlot[]>([
        { startTime: '17:00', endTime: '18:00' },
        { startTime: '18:00', endTime: '19:00' },
    ]);
    const [promoCode, setPromoCode] = useState('FLASH100');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Simple message fields
    const [msgHeader, setMsgHeader] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [msgBtnLabel, setMsgBtnLabel] = useState('จองสนาม');
    const [msgBtnUrl, setMsgBtnUrl] = useState(LIFF_BASE);
    const [msgBgColor, setMsgBgColor] = useState('#1e293b');

    // Custom JSON
    const [customJson, setCustomJson] = useState('');

    // Audience
    const [audienceMode, setAudienceMode] = useState<AudienceMode>('broadcast');
    const [userIdsRaw, setUserIdsRaw] = useState('');

    // Submission state
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    // ── Build message object for preview + sending ──
    const builtMessage = useMemo(() => {
        if (template === 'flash_deal') {
            return buildFlashDealCarousel(fieldId, fieldName, slots, promoCode, date);
        }
        if (template === 'simple_message') {
            return buildSimpleMessage(msgHeader, msgBody, msgBtnLabel, msgBtnUrl, msgBgColor);
        }
        if (template === 'custom_json') {
            try { return JSON.parse(customJson); } catch { return null; }
        }
        return null;
    }, [template, fieldId, fieldName, slots, promoCode, date, msgHeader, msgBody, msgBtnLabel, msgBtnUrl, msgBgColor, customJson]);

    // ── Handlers ──
    const addSlot = () => setSlots(s => [...s, { startTime: '19:00', endTime: '20:00' }]);
    const removeSlot = (i: number) => setSlots(s => s.filter((_, idx) => idx !== i));
    const updateSlot = (i: number, field: keyof TimeSlot, value: string) => {
        setSlots(s => s.map((sl, idx) => idx === i ? { ...sl, [field]: value } : sl));
    };

    const handleSend = async () => {
        if (!builtMessage) { alert('ข้อมูลไม่ครบหรือ JSON ไม่ถูกต้อง'); return; }
        const confirmed = window.confirm(
            audienceMode === 'broadcast'
                ? '⚠️ ยืนยันการส่ง Broadcast ไปยัง "ผู้ติดตามทุกคน"?'
                : `⚠️ ยืนยันส่ง Multicast ไปยัง ${userIdsRaw.split('\n').filter(Boolean).length} คน?`
        );
        if (!confirmed) return;

        setSending(true);
        setResult(null);

        try {
            const payload: any = {
                mode: audienceMode,
                messages: [builtMessage],
            };
            if (audienceMode === 'multicast') {
                payload.userIds = userIdsRaw.split('\n').map(s => s.trim()).filter(Boolean);
            }

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
            setResult({ ok: true, message: data.message || 'ส่งสำเร็จ!' });
        } catch (e: any) {
            setResult({ ok: false, message: e.message });
        } finally {
            setSending(false);
        }
    };

    // ── Render ──
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Radio className="text-indigo-500" size={26} /> ส่ง LINE Broadcast
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">สร้างและส่ง Flex Message ผ่าน LINE Messaging API โดยตรง</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ── Left Panel: Form ── */}
                    <div className="space-y-5">

                        {/* Template Selector */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                            <h2 className="font-semibold text-gray-800 mb-3">🎨 เลือก Template</h2>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { id: 'flash_deal', label: '🔥 Flash Deal', desc: 'Carousel สล็อต' },
                                    { id: 'simple_message', label: '📢 ข้อความ', desc: 'ข้อความ + ปุ่ม' },
                                    { id: 'custom_json', label: '🛠️ Custom', desc: 'วาง JSON' },
                                ] as const).map(t => (
                                    <button key={t.id} onClick={() => setTemplate(t.id)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${template === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <p className="font-semibold text-sm text-gray-800">{t.label}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Flash Deal Form */}
                        {template === 'flash_deal' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                                <h2 className="font-semibold text-gray-800">⚙️ ตั้งค่า Flash Deal</h2>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">สนาม (ID)</label>
                                        <select value={fieldId} onChange={e => setFieldId(Number(e.target.value))}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none">
                                            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>สนาม {n}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อที่แสดง</label>
                                        <input value={fieldName} onChange={e => setFieldName(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                            placeholder="เช่น สนาม 6 (7 คน)" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">วันที่</label>
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">โค้ดส่วนลด</label>
                                        <input value={promoCode} onChange={e => setPromoCode(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                            placeholder="เช่น FLASH100" />
                                    </div>
                                </div>

                                {/* Slots */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-gray-600">สล็อตเวลา (สูงสุด 10 card)</label>
                                        <button onClick={addSlot} disabled={slots.length >= 10}
                                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-30">
                                            <Plus size={13} /> เพิ่มสล็อต
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {slots.map((slot, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                                <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                                                <input type="time" value={slot.startTime}
                                                    onChange={e => updateSlot(i, 'startTime', e.target.value)}
                                                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
                                                <span className="text-gray-400 text-xs">→</span>
                                                <input type="time" value={slot.endTime}
                                                    onChange={e => updateSlot(i, 'endTime', e.target.value)}
                                                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-300" />
                                                <button onClick={() => removeSlot(i)} disabled={slots.length === 1}
                                                    className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Simple Message Form */}
                        {template === 'simple_message' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                                <h2 className="font-semibold text-gray-800">⚙️ ตั้งค่าข้อความ</h2>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">หัวข้อ (Header)</label>
                                    <input value={msgHeader} onChange={e => setMsgHeader(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="เช่น 🎉 โปรพิเศษประจำสัปดาห์!" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียด (Body)</label>
                                    <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                        placeholder="รายละเอียดข้อความ..." />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อปุ่ม</label>
                                        <input value={msgBtnLabel} onChange={e => setMsgBtnLabel(e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">สี Header</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={msgBgColor} onChange={e => setMsgBgColor(e.target.value)}
                                                className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                                            <input value={msgBgColor} onChange={e => setMsgBgColor(e.target.value)}
                                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">URL ปุ่ม</label>
                                    <input value={msgBtnUrl} onChange={e => setMsgBtnUrl(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="https://liff.line.me/..." />
                                </div>
                            </div>
                        )}

                        {/* Custom JSON Form */}
                        {template === 'custom_json' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h2 className="font-semibold text-gray-800 mb-3">🛠️ Custom JSON</h2>
                                <textarea value={customJson} onChange={e => setCustomJson(e.target.value)}
                                    rows={12}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-gray-50"
                                    placeholder={'{\n  "type": "flex",\n  "altText": "...",\n  "contents": {...}\n}'} />
                                {customJson && !builtMessage && (
                                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                                        <AlertCircle size={12} /> JSON ไม่ถูกต้อง
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Audience */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                            <h2 className="font-semibold text-gray-800">🎯 กลุ่มเป้าหมาย</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'broadcast', label: '📡 ทุกคน', desc: 'ผู้ติดตาม OA ทั้งหมด' },
                                    { id: 'multicast', label: '👥 เฉพาะกลุ่ม', desc: 'ระบุ User IDs' },
                                ] as const).map(a => (
                                    <button key={a.id} onClick={() => setAudienceMode(a.id)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${audienceMode === a.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <p className="font-semibold text-sm text-gray-800">{a.label}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{a.desc}</p>
                                    </button>
                                ))}
                            </div>
                            {audienceMode === 'multicast' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">User IDs (1 คนต่อบรรทัด)</label>
                                    <textarea value={userIdsRaw} onChange={e => setUserIdsRaw(e.target.value)}
                                        rows={4}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                        placeholder={"Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {userIdsRaw.split('\n').filter(Boolean).length} User IDs
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Result */}
                        {result && (
                            <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                {result.ok
                                    ? <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
                                    : <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
                                <p className={`text-sm font-medium ${result.ok ? 'text-green-700' : 'text-red-600'}`}>
                                    {result.message}
                                </p>
                            </div>
                        )}

                        {/* Send Button */}
                        <button onClick={handleSend} disabled={sending || !builtMessage}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md transition-all active:scale-95">
                            {sending
                                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังส่ง...</>
                                : <><Send size={18} /> ส่ง{audienceMode === 'broadcast' ? ' Broadcast' : ' Multicast'}</>}
                        </button>
                    </div>

                    {/* ── Right Panel: Preview ── */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
                            <button onClick={() => setShowPreview(p => !p)}
                                className="flex items-center justify-between w-full mb-4 group">
                                <h2 className="font-semibold text-gray-800 text-base">📱 ตัวอย่างใน LINE</h2>
                                {showPreview ? <ChevronUp size={16} className="text-gray-400 group-hover:text-gray-600" /> : <ChevronDown size={16} className="text-gray-400 group-hover:text-gray-600" />}
                            </button>

                            {showPreview && (
                                <div className="bg-gray-100 rounded-xl p-4 min-h-48">
                                    {/* Simulated LINE chat bubble */}
                                    <div className="flex gap-2 items-end">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0 mb-1">
                                            <span className="text-white text-xs font-bold">OA</span>
                                        </div>
                                        <div className="flex-1 max-w-[260px]">
                                            <FlexPreviewCard message={builtMessage} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Alt text preview */}
                            {builtMessage?.altText && (
                                <p className="mt-3 text-[11px] text-gray-400 italic border-t border-gray-100 pt-3">
                                    <span className="text-gray-500 font-medium">Alt Text:</span> {builtMessage.altText}
                                </p>
                            )}

                            {/* LIFF URL preview for flash deal */}
                            {template === 'flash_deal' && slots[0] && (
                                <div className="mt-3 border-t border-gray-100 pt-3">
                                    <p className="text-[11px] text-gray-500 font-medium mb-1">ตัวอย่าง URL สล็อตแรก:</p>
                                    <p className="text-[10px] text-indigo-500 break-all font-mono bg-indigo-50 p-2 rounded-lg">
                                        {`${LIFF_BASE}/?fieldId=${fieldId}&startTime=${slots[0].startTime}&endTime=${slots[0].endTime}&date=${date}`}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
