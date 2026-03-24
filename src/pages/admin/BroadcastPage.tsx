import { useState, useMemo, useEffect } from 'react';
import { Send, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Plus, Trash2, Radio, Lock, Edit2, Save, FileText, Calendar, Users, Eye } from 'lucide-react';
import { supabase } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateType = 'flash_deal' | 'simple_message' | 'custom_json';
type AudienceMode = 'broadcast' | 'multicast' | 'multicast_by_tag' | 'exclude_by_tag';
type ForcePayment = '' | 'QR' | 'CASH';

interface Campaign {
    id: string;
    name: string;
    discount_amount: number;
    discount_percent: number;
    description?: string;
    secret_codes?: string[];
    payment_methods?: string[]; // e.g. ['QR'] | ['CASH'] | ['QR','CASH'] | []
}

interface TimeSlot {
    startTime: string;
    endTime: string;
    normalPrice: number;
    discountPrice: number;
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
    date: string,
    forcePayment: ForcePayment = ''
) {
    const color = FIELD_COLORS[fieldId] || '#334155';
    
    // Format date properly (e.g. 21 มีนาคม 2569)
    let displayDate = date;
    try {
        if (date) {
            displayDate = new Date(date).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        }
    } catch (e) { /* ignore */ }

    const bubbles = slots.map((slot) => {
        // Use per-slot prices
        const normalPrice = slot.normalPrice || 0;
        const discountPrice = slot.discountPrice || 0;
        let percentStr = null;
        if (normalPrice > discountPrice && discountPrice > 0) {
            percentStr = `ลด ${Math.round(((normalPrice - discountPrice) / normalPrice) * 100)}%`;
        }

        return {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: color,
                paddingAll: '16px',
                contents: [{
                    type: 'text',
                    text: '⚡ FLASH DEAL TODAY',
                    color: '#ffffff',
                    weight: 'bold',
                    size: 'sm',
                    align: 'center'
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
                paddingAll: '24px',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        alignItems: 'center',
                        contents: [
                            { type: 'text', text: fieldName, weight: 'bold', size: 'xl', color: '#1e293b', flex: 1 },
                            ...(percentStr ? [{
                                type: 'box',
                                layout: 'vertical',
                                backgroundColor: '#ffe4e6',
                                cornerRadius: 'sm',
                                paddingStart: '8px',
                                paddingEnd: '8px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                flex: 0,
                                contents: [{
                                    type: 'text',
                                    text: percentStr,
                                    size: 'xs',
                                    color: '#e11d48',
                                    weight: 'bold',
                                    align: 'center'
                                }]
                            }] : [])
                        ]
                    },
                    {
                        type: 'separator',
                        margin: 'lg',
                        color: '#e2e8f0'
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'lg',
                        contents: [
                            {
                                type: 'box',
                                layout: 'vertical',
                                flex: 3,
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'box',
                                        layout: 'horizontal',
                                        spacing: 'sm',
                                        contents: [
                                            { type: 'text', text: '📅', flex: 0, size: 'sm' },
                                            { type: 'text', text: displayDate, size: 'sm', color: '#475569', weight: 'bold', wrap: true }
                                        ]
                                    },
                                    {
                                        type: 'box',
                                        layout: 'horizontal',
                                        spacing: 'sm',
                                        contents: [
                                            { type: 'text', text: '⏰', flex: 0, size: 'sm' },
                                            { type: 'text', text: `${slot.startTime} - ${slot.endTime}`, size: 'sm', color: '#16a34a', weight: 'bold', wrap: true }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                flex: 2,
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                contents: [
                                    ...(normalPrice ? [{
                                        type: 'text',
                                        text: `฿${normalPrice.toLocaleString()}`,
                                        size: 'xs',
                                        color: '#94a3b8',
                                        decoration: 'line-through'
                                    }] : []),
                                    ...(discountPrice ? [{
                                        type: 'text',
                                        text: `฿${discountPrice.toLocaleString()}`,
                                        size: 'lg',
                                        color: '#e11d48',
                                        weight: 'bold'
                                    }] : [])
                                ]
                            }
                        ]
                    },


                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '24px',
                paddingTop: '0px',
                contents: [{
                    type: 'button',
                    style: 'primary',
                    color: color,
                    action: {
                        type: 'uri',
                        label: `จองรอบ ${slot.startTime} เลย!`,
                        uri: `${LIFF_BASE}/?redirect=booking-v3&fieldId=${fieldId}&startTime=${slot.startTime}&endTime=${slot.endTime}${date ? `&date=${date}` : ''}${forcePayment ? `&forcePayment=${forcePayment}` : ''}${promoCode ? `&promoCode=${promoCode}` : ''}`
                    }
                }]
            }
        };
    });

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

const FLEX_SPACING: Record<string, string> = {
    none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '20px'
};

const FLEX_MARGIN: Record<string, string> = {
    none: '0', xs: '2px', sm: '4px', md: '10px', lg: '16px', xl: '20px', xxl: '24px'
};

const FLEX_TEXT_SIZE: Record<string, string> = {
    xxs: '11px', xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '18px', xxl: '22px', '3xl': '26px', '4xl': '30px', '5xl': '36px'
};

const FLEX_ICON_SIZE: Record<string, string> = {
    xxs: '12px', xs: '14px', sm: '16px', md: '18px', lg: '20px', xl: '24px', xxl: '28px', '3xl': '32px'
};

function FlexNode({ node, parentLayout }: { node: any; parentLayout?: string }) {
    if (!node) return null;

    const isInHorizontal = parentLayout === 'horizontal' || parentLayout === 'baseline';

    if (node.type === 'box') {
        const layout = node.layout || 'vertical';
        const isH = layout === 'horizontal' || layout === 'baseline';

        const style: React.CSSProperties = {
            display: 'flex',
            flexDirection: isH ? 'row' : 'column',
            gap: FLEX_SPACING[node.spacing] || '0',
            backgroundColor: node.backgroundColor || 'transparent',
            alignItems: layout === 'baseline' ? 'center' : (node.alignItems || (isH ? 'center' : 'stretch')),
            justifyContent: node.justifyContent || 'flex-start',
        };

        // Handle padding (paddingAll, paddingTop, paddingBottom, paddingStart, paddingEnd)
        if (node.paddingAll) style.padding = node.paddingAll;
        if (node.paddingTop) style.paddingTop = node.paddingTop;
        if (node.paddingBottom) style.paddingBottom = node.paddingBottom;
        if (node.paddingStart) style.paddingLeft = node.paddingStart;
        if (node.paddingEnd) style.paddingRight = node.paddingEnd;

        // Handle flex inside horizontal parent
        if (isInHorizontal) {
            style.flex = node.flex ?? 1;
            style.minWidth = 0;
        }

        // Margin
        if (node.margin && node.margin !== 'none') {
            style.marginTop = FLEX_MARGIN[node.margin] || '0';
        }

        // Width for vertical parent
        if (!isInHorizontal) {
            style.width = '100%';
        }

        return (
            <div style={style}>
                {node.contents?.map((child: any, i: number) => (
                    <FlexNode key={i} node={child} parentLayout={layout} />
                ))}
            </div>
        );
    }

    if (node.type === 'text') {
        const style: React.CSSProperties = {
            color: node.color || '#111111',
            fontSize: FLEX_TEXT_SIZE[node.size] || '14px',
            fontWeight: node.weight === 'bold' ? 700 : 400,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: node.wrap ? 'normal' : 'nowrap',
            textAlign: node.align || 'left',
        };

        // Flex inside horizontal parent
        if (isInHorizontal) {
            style.flex = node.flex ?? 1;
            style.minWidth = 0;
        }

        // Margin
        if (node.margin && node.margin !== 'none') {
            style.marginTop = isInHorizontal ? '0' : (FLEX_MARGIN[node.margin] || '0');
            if (isInHorizontal) style.marginLeft = FLEX_MARGIN[node.margin] || '0';
        }

        return <div style={style}>{node.text}</div>;
    }

    if (node.type === 'image') {
        const style: React.CSSProperties = {
            width: node.size === 'full' ? '100%' : (node.size || 'auto'),
            objectFit: node.aspectMode === 'cover' ? 'cover' : 'contain',
            display: 'block',
        };
        if (node.aspectRatio) {
            style.aspectRatio = node.aspectRatio.replace(':', '/');
        }

        // Margin
        const wrapStyle: React.CSSProperties = {};
        if (isInHorizontal) {
            wrapStyle.flex = node.flex ?? 0;
            wrapStyle.minWidth = 0;
        } else {
            wrapStyle.width = node.size === 'full' ? '100%' : 'auto';
        }
        if (node.margin && node.margin !== 'none') {
            wrapStyle.marginTop = FLEX_MARGIN[node.margin] || '0';
        }

        return (
            <div style={wrapStyle}>
                <img src={node.url} alt="" style={style} />
            </div>
        );
    }

    if (node.type === 'icon') {
        const sz = FLEX_ICON_SIZE[node.size] || '16px';
        const szNum = parseInt(sz);
        const style: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            width: sz,
            height: sz,
        };
        if (node.margin && node.margin !== 'none') {
            style.marginLeft = FLEX_MARGIN[node.margin] || '0';
        }
        if (isInHorizontal && node.flex !== undefined) {
            style.flex = node.flex;
        }

        // Detect if URL contains star pattern for smart fallback color
        const isGoldStar = node.url?.includes('gold_star');
        const isGrayStar = node.url?.includes('gray_star');
        const isStar = isGoldStar || isGrayStar;
        const starColor = isGoldStar ? '#fbbf24' : '#d1d5db';

        return (
            <div style={style}>
                <img
                    src={node.url}
                    alt=""
                    style={{ width: sz, height: sz, objectFit: 'contain' }}
                    onError={(e) => {
                        // Replace broken image with inline SVG fallback
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && isStar) {
                            parent.innerHTML = `<svg width="${szNum}" height="${szNum}" viewBox="0 0 24 24" fill="${starColor}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
                        } else if (parent) {
                            parent.innerHTML = `<div style="width:${sz};height:${sz};background:#e5e7eb;border-radius:2px;"></div>`;
                        }
                    }}
                />
            </div>
        );
    }

    if (node.type === 'button') {
        const isLink = node.style === 'link';
        const isPrimary = node.style === 'primary';
        const style: React.CSSProperties = {
            width: '100%',
            padding: node.height === 'sm' ? '6px 12px' : '10px 16px',
            backgroundColor: isPrimary ? (node.color || '#06c755') : 'transparent',
            color: isPrimary ? '#ffffff' : (isLink ? '#4f86c6' : (node.color || '#06c755')),
            textAlign: 'center',
            borderRadius: isPrimary ? '8px' : '0',
            fontWeight: isLink ? 500 : 700,
            fontSize: '14px',
            cursor: 'pointer',
            border: 'none',
        };
        if (node.margin && node.margin !== 'none') {
            style.marginTop = FLEX_MARGIN[node.margin] || '0';
        }
        return <div style={style}>{node.action?.label || 'Button'}</div>;
    }

    if (node.type === 'separator') {
        const style: React.CSSProperties = {
            width: '100%', height: '1px',
            backgroundColor: node.color || '#dcdfe5',
        };
        if (node.margin && node.margin !== 'none') {
            style.marginTop = FLEX_MARGIN[node.margin] || '0';
        }
        return <div style={style} />;
    }

    if (node.type === 'filler') {
        return <div style={{ flex: 1 }} />;
    }

    return null;
}

function FlexPreviewCard({ message }: { message: any }) {
    try {
        const bubble = message?.contents?.type === 'carousel'
            ? message.contents.contents[0]
            : message?.contents;

        if (!bubble) return <div className="text-gray-400 text-sm italic text-center py-8">กรอกข้อมูลเพื่อดูตัวอย่าง</div>;

        return (
            <div style={{
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb',
                maxWidth: '280px',
                margin: '0 auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {bubble.header && (
                    <FlexNode node={bubble.header} />
                )}
                {bubble.hero && (
                    <FlexNode node={bubble.hero} />
                )}
                {bubble.body && (
                    <div style={{
                        padding: bubble.body.paddingAll || '16px',
                        paddingTop: bubble.body.paddingTop || undefined,
                        paddingBottom: bubble.body.paddingBottom || undefined,
                        backgroundColor: bubble.body.backgroundColor || '#ffffff',
                    }}>
                        {bubble.body.contents?.map((child: any, i: number) => (
                            <FlexNode key={i} node={child} parentLayout={bubble.body.layout || 'vertical'} />
                        ))}
                    </div>
                )}
                {bubble.footer && (
                    <div style={{
                        padding: bubble.footer.paddingAll || '12px',
                        paddingTop: bubble.footer.paddingTop || '0',
                        backgroundColor: bubble.footer.backgroundColor || '#ffffff',
                    }}>
                        {bubble.footer.contents?.map((child: any, i: number) => (
                            <FlexNode key={i} node={child} parentLayout={bubble.footer.layout || 'vertical'} />
                        ))}
                    </div>
                )}
                {message?.contents?.type === 'carousel' && message.contents.contents.length > 1 && (
                    <div style={{ backgroundColor: '#f9fafb', textAlign: 'center', padding: '8px', fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                        + อีก {message.contents.contents.length - 1} สล็อต (เลื่อนดูได้)
                    </div>
                )}
            </div>
        );
    } catch {
        return <div className="text-red-400 text-sm text-center py-4">Preview Error</div>;
    }
}

// ─── Price Calculator (matches booking logic: dual round-up at 18:00) ─────────
function calcSlotPrice(pricePre: number, pricePost: number, startTime: string, endTime: string): number {
    const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    };
    const sMins = toMins(startTime);
    const eMins = toMins(endTime);
    if (eMins <= sMins) return 0;
    const cutoff = 18 * 60;
    const preHours = Math.max(0, Math.min(eMins, cutoff) - sMins) / 60;
    const postHours = Math.max(0, eMins - Math.max(sMins, cutoff)) / 60;
    let prePrice = preHours * pricePre;
    let postPrice = postHours * pricePost;
    if (prePrice > 0 && prePrice % 100 !== 0) prePrice = Math.ceil(prePrice / 100) * 100;
    if (postPrice > 0 && postPrice % 100 !== 0) postPrice = Math.ceil(postPrice / 100) * 100;
    return Math.round(prePrice + postPrice);
}

// ─── Clean Time Picker: hour select + :00/:30 toggle ──────────────────────────
function SlotTimePicker({
    startTime, endTime, onChange
}: {
    startTime: string;
    endTime: string;
    onChange: (start: string, end: string) => void;
}) {
    const hours = Array.from({ length: 16 }, (_, i) => String(i + 8).padStart(2, '0'));
    const [sH, sM] = (startTime || '17:00').split(':');
    const [eH, eM] = (endTime || '18:00').split(':');

    return (
        <div className="flex items-end gap-2">
            <div className="flex-1">
                <p className="text-[10px] text-gray-400 mb-1">เวลาเริ่ม</p>
                <div className="flex gap-1">
                    <select value={sH} onChange={e => onChange(`${e.target.value}:${sM}`, endTime)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300 font-medium">
                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div className="flex gap-1">
                        {['00','30'].map(m => (
                            <button key={m} type="button" onClick={() => onChange(`${sH}:${m}`, endTime)}
                                className={`px-2 rounded-lg text-xs font-bold border transition-all ${sM === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                                :{m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <span className="text-gray-300 pb-2">→</span>
            <div className="flex-1">
                <p className="text-[10px] text-gray-400 mb-1">เวลาสิ้นสุด</p>
                <div className="flex gap-1">
                    <select value={eH} onChange={e => onChange(startTime, `${e.target.value}:${eM}`)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300 font-medium">
                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div className="flex gap-1">
                        {['00','30'].map(m => (
                            <button key={m} type="button" onClick={() => onChange(startTime, `${eH}:${m}`)}
                                className={`px-2 rounded-lg text-xs font-bold border transition-all ${eM === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                                :{m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---

export default function BroadcastPage() {
    // ─── List View States ───
    const [view, setView] = useState<'list' | 'form'>('list');
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
    
    // ─── General Info ───
    const [broadcastName, setBroadcastName] = useState('');
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

    // Template
    const [template, setTemplate] = useState<TemplateType>('flash_deal');

    // Flash Deal fields
    const [fieldId, setFieldId] = useState<number>(1);
    const [fieldName, setFieldName] = useState('สนาม 1');
    const [slots, setSlots] = useState<TimeSlot[]>([
        { startTime: '17:00', endTime: '18:00', normalPrice: 1000, discountPrice: 500 },
        { startTime: '18:00', endTime: '19:00', normalPrice: 1200, discountPrice: 600 },
    ]);
    const [promoCode, setPromoCode] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [forcePayment, setForcePayment] = useState<ForcePayment>('');
    // Field price rates fetched from DB
    const [fieldPrices, setFieldPrices] = useState<{ pre: number; post: number } | null>(null);

    // Simple message fields
    const [msgHeader, setMsgHeader] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [msgBtnLabel, setMsgBtnLabel] = useState('จองสนาม');
    const [msgBtnUrl, setMsgBtnUrl] = useState(LIFF_BASE);
    const [msgBgColor, setMsgBgColor] = useState('#1e293b');

    // Custom JSON
    const [customJson, setCustomJson] = useState('');
    const [customAltText, setCustomAltText] = useState('ประกาศจากสนาม');

    // Audience
    const [audienceMode, setAudienceMode] = useState<AudienceMode>('broadcast');
    const [userIdsRaw, setUserIdsRaw] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    // Submission state
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    // Load campaigns on mount
    useEffect(() => {
        const fetchCampaigns = async () => {
            setCampaignsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('campaigns')
                    .select('id, name, discount_amount, discount_percent, description, secret_codes, payment_methods')
                    .eq('status', 'active')
                    .order('created_at', { ascending: false });
                if (!error && data) setCampaigns(data);
            } catch (e) {
                console.error('Failed to fetch campaigns:', e);
            } finally {
                setCampaignsLoading(false);
            }
        };
        fetchCampaigns();
    }, []);

    // Fetch unique tags from profiles
    useEffect(() => {
        const fetchTags = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('tags')
                .not('tags', 'is', null);
            if (data) {
                const allTags = data.flatMap((p: any) => p.tags || []);
                const unique = Array.from(new Set(allTags)).sort() as string[];
                setAvailableTags(unique);
            }
        };
        fetchTags();
    }, []);

    // Fetch field price rates when fieldId changes
    useEffect(() => {
        const fetchFieldPrices = async () => {
            const { data } = await supabase
                .from('fields')
                .select('price_pre, price_post')
                .eq('id', fieldId)
                .maybeSingle();
            if (data) setFieldPrices({ pre: data.price_pre || 0, post: data.price_post || 0 });
        };
        fetchFieldPrices();
    }, [fieldId]);

    // Auto-recalculate normalPrice for all slots when fieldPrices changes
    useEffect(() => {
        if (!fieldPrices) return;
        setSlots(prev => prev.map(sl => ({
            ...sl,
            normalPrice: calcSlotPrice(fieldPrices.pre, fieldPrices.post, sl.startTime, sl.endTime)
        })));
    }, [fieldPrices]);

    // Auto-recalculate discountPrice for all slots when campaign or slots' normalPrice changes
    useEffect(() => {
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        if (!campaign) return;
        setSlots(prev => prev.map(sl => ({
            ...sl,
            discountPrice: campaign.discount_amount > 0
                ? Math.max(0, sl.normalPrice - campaign.discount_amount)
                : campaign.discount_percent > 0
                    ? Math.round(sl.normalPrice * (1 - campaign.discount_percent / 100))
                    : sl.discountPrice
        })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, campaigns]);

    // Auto-sync forcePayment from campaign's payment_methods setting
    useEffect(() => {
        if (!selectedCampaignId) return;
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        if (!campaign?.payment_methods?.length) return;
        const pm = campaign.payment_methods;
        if (pm.length === 1 && pm[0] === 'QR') setForcePayment('QR');
        else if (pm.length === 1 && pm[0] === 'CASH') setForcePayment('CASH');
        else setForcePayment(''); // both allowed
    }, [selectedCampaignId, campaigns]);

    useEffect(() => {
        if (view === 'list') {
            fetchBroadcasts();
        }
    }, [view]);

    const fetchBroadcasts = async () => {
        setLoadingBroadcasts(true);
        try {
            const { data, error } = await supabase
                .from('broadcasts')
                .select('*')
                .order('created_at', { ascending: false });
            if (!error && data) setBroadcasts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingBroadcasts(false);
        }
    };

    const handleCreateNew = () => {
        setEditingDraftId(null);
        setBroadcastName('');
        setTemplate('flash_deal');
        setFieldId(1);
        setFieldName('สนาม 1');
        setSlots([
            { startTime: '17:00', endTime: '18:00', normalPrice: 1000, discountPrice: 500 },
            { startTime: '18:00', endTime: '19:00', normalPrice: 1200, discountPrice: 600 },
        ]);
        setPromoCode('');
        setSelectedCampaignId('');
        setDate(new Date().toISOString().split('T')[0]);
        setForcePayment('');
        setMsgHeader('');
        setMsgBody('');
        setMsgBtnLabel('จองสนาม');
        setMsgBtnUrl(LIFF_BASE);
        setMsgBgColor('#1e293b');
        setCustomJson('');
        setCustomAltText('ประกาศจากสนาม');
        setAudienceMode('broadcast');
        setUserIdsRaw('');
        setSelectedTags([]);
        setResult(null);
        setView('form');
    };

    const handleEditDraft = (b: any) => {
        setEditingDraftId(b.id);
        setBroadcastName(b.name);
        setTemplate(b.template_type as TemplateType);
        setAudienceMode(b.audience_mode as AudienceMode);
        setUserIdsRaw(b.audience_user_ids ? b.audience_user_ids.join('\n') : '');
        setSelectedTags(b.content_payload?.selectedTags || []);

        const p = b.content_payload || {};
        if (b.template_type === 'flash_deal') {
            setFieldId(p.fieldId || 1);
            setFieldName(p.fieldName || 'สนาม 1');
            setSlots((p.slots || []).map((s: any) => ({
                startTime: s.startTime || '17:00',
                endTime: s.endTime || '18:00',
                normalPrice: s.normalPrice != null ? s.normalPrice : (p.normalPrice || 0),
                discountPrice: s.discountPrice != null ? s.discountPrice : (p.discountPrice || 0),
            })));
            setPromoCode(p.promoCode || '');
            setSelectedCampaignId(p.selectedCampaignId || '');
            setDate(p.date || new Date().toISOString().split('T')[0]);
            setForcePayment(p.forcePayment || '');
        } else if (b.template_type === 'simple_message') {
            setMsgHeader(p.msgHeader || '');
            setMsgBody(p.msgBody || '');
            setMsgBtnLabel(p.msgBtnLabel || 'จองสนาม');
            setMsgBtnUrl(p.msgBtnUrl || LIFF_BASE);
            setMsgBgColor(p.msgBgColor || '#1e293b');
        } else if (b.template_type === 'custom_json') {
            setCustomJson(p.customJson || '');
            setCustomAltText(p.customAltText || 'ประกาศจากสนาม');
        }
        setResult(null);
        setView('form');
    };

    const buildPayloadForSave = () => {
        const payload: any = {};
        if (template === 'flash_deal') {
            payload.fieldId = fieldId; payload.fieldName = fieldName; payload.slots = slots;
            payload.promoCode = promoCode; payload.selectedCampaignId = selectedCampaignId;
            payload.date = date; payload.forcePayment = forcePayment;
        } else if (template === 'simple_message') {
            payload.msgHeader = msgHeader; payload.msgBody = msgBody; payload.msgBtnLabel = msgBtnLabel;
            payload.msgBtnUrl = msgBtnUrl; payload.msgBgColor = msgBgColor;
        } else if (template === 'custom_json') {
            payload.customJson = customJson; payload.customAltText = customAltText;
        }
        return payload;
    };

    const handleSaveDraft = async () => {
        if (!broadcastName.trim()) { alert('กรุณาตั้งชื่อ Broadcast'); return; }
        setSending(true);
        setResult(null);
        try {
            const payload = buildPayloadForSave();
            if (audienceMode === 'multicast_by_tag' || audienceMode === 'exclude_by_tag') {
                payload.selectedTags = selectedTags;
            }
            const dataToSave = {
                name: broadcastName,
                template_type: template,
                audience_mode: audienceMode,
                audience_user_ids: audienceMode === 'multicast' ? userIdsRaw.split('\n').map(s => s.trim()).filter(Boolean) : null,
                content_payload: payload,
                built_message: builtMessage,
                status: 'draft'
            };

            if (editingDraftId) {
                const { error } = await supabase.from('broadcasts').update(dataToSave).eq('id', editingDraftId);
                if (error) throw error;
                setResult({ ok: true, message: 'บันทึกฉบับร่างสำเร็จ!' });
            } else {
                const { data, error } = await supabase.from('broadcasts').insert([dataToSave]).select('id').single();
                if (error) throw error;
                setEditingDraftId(data.id);
                setResult({ ok: true, message: 'สร้างฉบับร่างสำเร็จ!' });
            }
            fetchBroadcasts();
        } catch (e: any) {
            setResult({ ok: false, message: e.message });
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ยืนยันลบฉบับร่างนี้?')) return;
        try {
            await supabase.from('broadcasts').delete().eq('id', id);
            fetchBroadcasts();
        } catch(e) { console.error(e); }
    };

    // ── Build message object for preview + sending ──
    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    // Use: manual code > campaign secret_codes[0] > empty
    const effectivePromoCode = promoCode || (selectedCampaign?.secret_codes?.[0] ?? '');

    const builtMessage = useMemo(() => {
        if (template === 'flash_deal') {
            return buildFlashDealCarousel(fieldId, fieldName, slots, effectivePromoCode, date, forcePayment);
        }
        if (template === 'simple_message') {
            return buildSimpleMessage(msgHeader, msgBody, msgBtnLabel, msgBtnUrl, msgBgColor);
        }
        if (template === 'custom_json') {
            try {
                const parsed = JSON.parse(customJson);
                // If user pasted only the inner Flex components (bubble or carousel), wrap it automatically
                if (parsed?.type === 'bubble' || parsed?.type === 'carousel') {
                    return {
                        type: 'flex',
                        altText: customAltText || 'ประกาศจากสนาม',
                        contents: parsed
                    };
                }
                // If user pasted full flex message but forgot altText, inject it
                if (parsed?.type === 'flex' && !parsed?.altText) {
                    parsed.altText = customAltText || 'ประกาศจากสนาม';
                }
                return parsed;
            } catch { return null; }
        }
        return null;
    }, [template, fieldId, fieldName, slots, effectivePromoCode, date, forcePayment, msgHeader, msgBody, msgBtnLabel, msgBtnUrl, msgBgColor, customJson, customAltText]);

    // ── Handlers ──
    const addSlot = () => {
        const last = slots[slots.length - 1];
        const newStart = last?.endTime || '19:00';
        const h = parseInt(newStart.split(':')[0]);
        const newEnd = `${String(h + 1).padStart(2, '0')}:00`;
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        const nPrice = fieldPrices ? calcSlotPrice(fieldPrices.pre, fieldPrices.post, newStart, newEnd) : (last?.normalPrice || 1000);
        const dPrice = campaign && (campaign.discount_amount || 0) > 0
            ? Math.max(0, nPrice - (campaign.discount_amount || 0))
            : campaign && (campaign.discount_percent || 0) > 0
                ? Math.round(nPrice * (1 - (campaign.discount_percent || 0) / 100))
                : (last?.discountPrice || 500);
        setSlots(s => [...s, { startTime: newStart, endTime: newEnd, normalPrice: nPrice, discountPrice: dPrice }]);
    };
    const removeSlot = (i: number) => setSlots(s => s.filter((_, idx) => idx !== i));
    const updateSlot = (i: number, field: keyof TimeSlot, value: string | number) => {
        setSlots(s => s.map((sl, idx) => {
            if (idx !== i) return sl;
            const updated = { ...sl, [field]: value };
            // If time changed and we have field prices, recalculate normalPrice and discountPrice
            if ((field === 'startTime' || field === 'endTime') && fieldPrices) {
                const newNormal = calcSlotPrice(fieldPrices.pre, fieldPrices.post, updated.startTime, updated.endTime);
                const campaign = campaigns.find(c => c.id === selectedCampaignId);
                const newDiscount = campaign && (campaign.discount_amount || 0) > 0
                    ? Math.max(0, newNormal - (campaign.discount_amount || 0))
                    : campaign && (campaign.discount_percent || 0) > 0
                        ? Math.round(newNormal * (1 - (campaign.discount_percent || 0) / 100))
                        : updated.discountPrice;
                return { ...updated, normalPrice: newNormal, discountPrice: newDiscount };
            }
            return updated;
        }));
    };

    const handleSend = async () => {
        if (!broadcastName.trim()) { alert('กรุณาตั้งชื่อ Broadcast ก่อนส่ง'); return; }
        if (!builtMessage) { alert('ข้อมูลไม่ครบหรือ JSON ไม่ถูกต้อง'); return; }

        // Resolve tag-based user IDs before confirming
        let resolvedUserIds: string[] | null = null;
        if (audienceMode === 'multicast_by_tag' || audienceMode === 'exclude_by_tag') {
            if (selectedTags.length === 0) { alert('กรุณาเลือก Tag อย่างน้อย 1 อัน'); return; }
            // Fetch all profiles
            const { data: allProfiles } = await supabase.from('profiles').select('user_id, tags');
            if (!allProfiles) { alert('ไม่สามารถดึงข้อมูลลูกค้าได้'); return; }
            if (audienceMode === 'multicast_by_tag') {
                // Send to profiles that HAVE any of the selected tags
                resolvedUserIds = allProfiles
                    .filter((p: any) => p.tags?.some((t: string) => selectedTags.includes(t)))
                    .map((p: any) => p.user_id);
            } else {
                // exclude_by_tag: fetch excluded user IDs, pass to Narrowcast
                resolvedUserIds = allProfiles
                    .filter((p: any) => p.tags?.some((t: string) => selectedTags.includes(t)))
                    .map((p: any) => p.user_id);
            }
        }

        const audienceCount = audienceMode === 'broadcast' ? 'ผู้ติดตามทุกคน'
            : audienceMode === 'multicast' ? `${userIdsRaw.split('\n').filter(Boolean).length} คน`
            : audienceMode === 'multicast_by_tag' ? `${resolvedUserIds?.length || 0} คน (Tag: ${selectedTags.join(', ')})`
            : `ผู้ติดตามทุกคน ยกเว้น ${resolvedUserIds?.length || 0} คน (Tag: ${selectedTags.join(', ')})`;

        const confirmed = window.confirm(`⚠️ ยืนยันส่ง Broadcast ไปยัง ${audienceCount} ทันที?`);
        if (!confirmed) return;

        setSending(true);
        setResult(null);
        let currentId = editingDraftId;
        try {
            const savedPayload = buildPayloadForSave();
            if (audienceMode === 'multicast_by_tag' || audienceMode === 'exclude_by_tag') {
                savedPayload.selectedTags = selectedTags;
            }
            const dataToSave = {
                name: broadcastName,
                template_type: template,
                audience_mode: audienceMode,
                audience_user_ids: audienceMode === 'multicast' ? userIdsRaw.split('\n').map(s => s.trim()).filter(Boolean) : null,
                content_payload: savedPayload,
                built_message: builtMessage,
                status: 'draft'
            };

            // Auto-save first
            if (currentId) {
                await supabase.from('broadcasts').update(dataToSave).eq('id', currentId);
            } else {
                const { data } = await supabase.from('broadcasts').insert([dataToSave]).select('id').single();
                currentId = data?.id;
                setEditingDraftId(currentId);
            }

            const sendPayload: any = { messages: [builtMessage] };
            if (audienceMode === 'multicast') {
                sendPayload.mode = 'multicast';
                sendPayload.userIds = userIdsRaw.split('\n').map(s => s.trim()).filter(Boolean);
            } else if (audienceMode === 'multicast_by_tag') {
                sendPayload.mode = 'multicast';
                sendPayload.userIds = resolvedUserIds || [];
            } else if (audienceMode === 'exclude_by_tag') {
                sendPayload.mode = 'narrowcast_exclude';
                sendPayload.excludeUserIds = resolvedUserIds || [];
            } else {
                sendPayload.mode = 'broadcast';
            }

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify(sendPayload)
            });

            const sentData = await res.json();
            if (!res.ok || sentData.error) {
                throw new Error(sentData.error || 'Unknown error');
            }
            
            // Mark as sent
            await supabase.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', currentId);
            
            setResult({ ok: true, message: sentData.message || 'ส่งสำเร็จ!' });
            fetchBroadcasts();
        } catch (e: any) {
            setResult({ ok: false, message: e.message });
        } finally {
            setSending(false);
        }
    };

    // ── Render ──
    if (view === 'list') {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Radio className="text-indigo-500" size={26} /> จัดการ Broadcast
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">สร้างฉบับร่างและประวัติการส่งข้อความ</p>
                        </div>
                        <button onClick={handleCreateNew}
                            className="flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all">
                            <Plus size={18} /> สร้างข้อความใหม่
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        {loadingBroadcasts ? (
                            <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</div>
                        ) : broadcasts.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                <p>ยังไม่มีข้อความ หรือฉบับร่างที่บันทึกไว้</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase uppercase">
                                        <th className="px-6 py-4 font-semibold text-gray-600">ชื่อ Broadcast</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">ประเภทเนื้อหา</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">ผู้รับ</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600">สถานะ</th>
                                        <th className="px-6 py-4 font-semibold text-gray-600 text-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {broadcasts.map(b => (
                                        <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(b.created_at).toLocaleString('th-TH')}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                                                    {b.template_type === 'flash_deal' ? '🔥 Flash Deal' : b.template_type === 'simple_message' ? '📢 ข้อความ' : '🛠️ Custom JSON'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <Users size={14} />
                                                    {b.audience_mode === 'broadcast' ? 'ทุกคน (LINE OA)'
                                                        : b.audience_mode === 'multicast_by_tag' ? `🏷️ Tag: ${b.content_payload?.selectedTags?.join(', ') || '-'}`
                                                        : b.audience_mode === 'exclude_by_tag' ? `🚫 ยกเว้น: ${b.content_payload?.selectedTags?.join(', ') || '-'}`
                                                        : `${b.audience_user_ids?.length || 0} คน`}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                                                    b.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {b.status === 'sent' ? <CheckCircle size={12} /> : <Save size={12} />}
                                                    {b.status === 'sent' ? 'ส่งแล้ว' : 'ฉบับร่าง'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditDraft(b)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                        title={b.status === 'sent' ? 'ดูรายละเอียด / ทำซ้ำ' : 'แก้ไข'}>
                                                        {b.status === 'sent' ? <Eye size={16} /> : <Edit2 size={16} />}
                                                    </button>
                                                    {b.status !== 'sent' && (
                                                        <button onClick={() => handleDelete(b.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="ลบ">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button onClick={() => setView('list')} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2 font-medium">
                            <ChevronDown className="rotate-90" size={16} /> กลับไปหน้ารายการ
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Radio className="text-indigo-500" size={26} /> {editingDraftId ? 'แก้ไข Broadcast' : 'สร้าง Broadcast ใหม่'}
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button onClick={handleSaveDraft} disabled={sending}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 font-medium rounded-lg shadow-sm transition-all disabled:opacity-50">
                            <Save size={16} /> บันทึกฉบับร่าง
                        </button>
                        <button onClick={handleSend} disabled={sending || !builtMessage}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-lg shadow-sm transition-all">
                            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                            ส่งทันที
                        </button>
                    </div>
                </div>

                {/* Name Input */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">🏷️ ชื่อ Broadcast (สำหรับอ้างอิงภายใน)</label>
                    <input value={broadcastName} onChange={e => setBroadcastName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="เช่น โพสต์โปรโมชั่น Flash Deal วันศุกร์" />
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

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">วันที่</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                                </div>



                                {/* Campaign / Promo Code row */}

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-gray-600">แคมเปญ / โค้ดส่วนลด</label>
                                        <a href="#/admin/campaigns" target="_blank"
                                            className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                                            + สร้างแคมเปญใหม่
                                        </a>
                                    </div>
                                    <select
                                        value={selectedCampaignId}
                                        onChange={e => setSelectedCampaignId(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 mb-2"
                                    >
                                        <option value="">-- ไม่เชื่อมแคมเปญ --</option>
                                        {campaignsLoading && <option disabled>กำลังโหลด...</option>}
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.discount_amount ? `(-฿${c.discount_amount})` : c.discount_percent ? `(-${c.discount_percent}%)` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <input value={promoCode} onChange={e => setPromoCode(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder={selectedCampaignId ? `โค้ดแคมเปญ (optional override)` : "โค้ดส่วนลด เช่น FLASH100"} />
                                    {effectivePromoCode && (
                                        <p className="text-xs text-indigo-500 mt-1">📌 โค้ดที่จะแสดงในข้อความ: <span className="font-bold">{effectivePromoCode}</span></p>
                                    )}
                                </div>

                                {/* Force Payment */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
                                            <Lock size={11} /> บังคับวิธีชำระเงิน
                                        </label>
                                        {(() => {
                                            const c = campaigns.find(x => x.id === selectedCampaignId);
                                            const pm = c?.payment_methods;
                                            if (pm?.length === 1) return (
                                                <span className="text-[10px] text-orange-500 font-medium">
                                                    📌 ล็อกโดยแคมเปญ ({pm[0]})
                                                </span>
                                            );
                                            return null;
                                        })()}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { val: '' as ForcePayment, label: '🔓 เปิดทั้งคู่', desc: 'QR + เงินสด' },
                                            { val: 'QR' as ForcePayment, label: '📲 QR เท่านั้น', desc: 'PromptPay' },
                                            { val: 'CASH' as ForcePayment, label: '💵 เงินสด', desc: 'หน้าสนาม' },
                                        ]).map(opt => (
                                            <button key={opt.val} onClick={() => setForcePayment(opt.val)}
                                                className={`p-2.5 rounded-xl border-2 text-left transition-all ${forcePayment === opt.val ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <p className="font-semibold text-xs text-gray-800">{opt.label}</p>
                                                <p className="text-[10px] text-gray-400">{opt.desc}</p>
                                            </button>
                                        ))}
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
                                            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-3">
                                                {/* Time Picker + delete */}
                                                <div className="flex items-start gap-2">
                                                    <span className="text-xs text-gray-400 w-5 text-center font-semibold mt-2">{i + 1}</span>
                                                    <div className="flex-1">
                                                        <SlotTimePicker
                                                            startTime={slot.startTime}
                                                            endTime={slot.endTime}
                                                            onChange={(start, end) => {
                                                                if (start) updateSlot(i, 'startTime', start);
                                                                if (end) updateSlot(i, 'endTime', end);
                                                            }}
                                                        />
                                                    </div>
                                                    <button onClick={() => removeSlot(i)} disabled={slots.length === 1}
                                                        className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors mt-2">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                {/* Price row */}
                                                <div className="flex items-center gap-2 pl-7">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-gray-400 mb-0.5">ราคาปกติ (฿)</p>
                                                        <input type="number" value={slot.normalPrice || ''}
                                                            onChange={e => updateSlot(i, 'normalPrice', Number(e.target.value))}
                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-300"
                                                            placeholder="เช่น 1000" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] text-red-400 mb-0.5">ราคาพิเศษ (฿)</p>
                                                        <input type="number" value={slot.discountPrice || ''}
                                                            onChange={e => updateSlot(i, 'discountPrice', Number(e.target.value))}
                                                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-red-200"
                                                            placeholder="เช่น 500" />
                                                    </div>
                                                    {slot.normalPrice > 0 && slot.discountPrice > 0 && slot.normalPrice > slot.discountPrice && (
                                                        <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap mt-4">
                                                            ลด {Math.round(((slot.normalPrice - slot.discountPrice) / slot.normalPrice) * 100)}%
                                                        </span>
                                                    )}
                                                </div>
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
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Alt Text (ข้อความแจ้งเตือนเมื่อยังไม่ได้กดอ่าน)</label>
                                    <input value={customAltText} onChange={e => setCustomAltText(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="เช่น ประกาศจากสนาม" />
                                </div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">JSON Payload (วางโค้ดจาก LINE Flex Simulator ได้เลย)</label>
                                <textarea value={customJson} onChange={e => setCustomJson(e.target.value)}
                                    rows={12}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-gray-50"
                                    placeholder={'คัดลอก JSON จาก LINE Flex Simulator (รูปแบบ Bubble หรือ Carousel) มาวางได้เลย\nระบบจะสร้างรูปแบบ Flex Message API ให้ส่งได้อัตโนมัติ'} />
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
                                    { id: 'multicast_by_tag', label: '🏷️ ตาม Tag', desc: 'ส่งหาคนที่มี tag' },
                                    { id: 'exclude_by_tag', label: '🚫 ยกเว้น Tag', desc: 'ส่งทุกคน OA ยกเว้น tag' },
                                ] as const).map(a => (
                                    <button key={a.id} onClick={() => { setAudienceMode(a.id); setSelectedTags([]); }}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            audienceMode === a.id
                                                ? a.id === 'exclude_by_tag' ? 'border-red-400 bg-red-50'
                                                : a.id === 'multicast_by_tag' ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}>
                                        <p className="font-semibold text-sm text-gray-800">{a.label}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{a.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {/* User IDs panel */}
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

                            {/* Tag picker panel */}
                            {(audienceMode === 'multicast_by_tag' || audienceMode === 'exclude_by_tag') && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-2">
                                        {audienceMode === 'multicast_by_tag' ? 'เลือก Tag ที่ต้องการส่งหา' : 'เลือก Tag ที่ต้องการยกเว้น'}
                                    </label>
                                    {availableTags.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">ยังไม่มี Tag ในระบบ (ไปติด Tag ที่หน้า Customers ก่อน)</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {availableTags.map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => setSelectedTags(prev =>
                                                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                                    )}
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
                                                        selectedTags.includes(tag)
                                                            ? audienceMode === 'exclude_by_tag'
                                                                ? 'bg-red-100 border-red-400 text-red-700'
                                                                : 'bg-indigo-100 border-indigo-500 text-indigo-700'
                                                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                                                    }`}
                                                >
                                                    {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedTags.length > 0 && (
                                        <p className={`text-xs mt-2 font-medium ${
                                            audienceMode === 'exclude_by_tag' ? 'text-red-500' : 'text-indigo-500'
                                        }`}>
                                            {audienceMode === 'multicast_by_tag'
                                                ? `📤 ส่งหาลูกค้าที่มี tag: ${selectedTags.join(', ')}`
                                                : `🚫 จะยกเว้นลูกค้าที่มี tag: ${selectedTags.join(', ')} (Narrowcast ไปทุกคนใน OA)`
                                            }
                                        </p>
                                    )}
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

                        {/* Removed duplicate Send Button since it's in the top header now */}
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
                                        {`${LIFF_BASE}/?fieldId=${fieldId}&startTime=${slots[0].startTime}&endTime=${slots[0].endTime}&date=${date}${forcePayment ? `&forcePayment=${forcePayment}` : ''}`}
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
