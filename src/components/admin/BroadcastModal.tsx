import { useState, useEffect } from 'react';
import { supabase } from '../../lib/api';
import { X, Send, Tag } from 'lucide-react';

interface BroadcastModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: any;
    onSuccess: () => void;
}

export default function BroadcastModal({ isOpen, onClose, campaign, onSuccess }: BroadcastModalProps) {
    const [targetType, setTargetType] = useState<'all' | 'tags'>('all');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [loadingTags, setLoadingTags] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTags();
        }
    }, [isOpen]);

    const fetchTags = async () => {
        setLoadingTags(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('tags');

            if (error) throw error;

            // Flatten and unify tags
            const allTags = new Set<string>();
            data?.forEach((p: any) => {
                if (p.tags && Array.isArray(p.tags)) {
                    p.tags.forEach((t: string) => allTags.add(t));
                }
            });

            // Add system default tags if not present
            allTags.add('vip');

            setAvailableTags(Array.from(allTags).sort());
        } catch (err) {
            console.error('Error fetching tags:', err);
        } finally {
            setLoadingTags(false);
        }
    };

    const handleToggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    const handleSend = async () => {
        if (!campaign) return;
        if (targetType === 'tags' && selectedTags.length === 0) {
            alert('Please select at least one tag');
            return;
        }

        if (!confirm(`Confirm broadcast "${campaign.name}" to ${targetType === 'all' ? 'ALL Users' : selectedTags.join(', ')}?`)) {
            return;
        }

        setSending(true);
        try {
            const { error } = await supabase.functions.invoke('broadcast-campaign', {
                body: {
                    campaignId: campaign.id,
                    targetTags: targetType === 'all' ? ['All'] : selectedTags
                }
            });

            if (error) throw error;

            alert('Broadcast sent successfully!');
            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Broadcast failed: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Send className="w-5 h-5 text-indigo-600" /> Broadcast Campaign
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{campaign?.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                        <div className="space-y-3">
                            <div className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 ${targetType === 'all' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                                onClick={() => setTargetType('all')}
                            >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetType === 'all' ? 'border-indigo-600' : 'border-gray-400'}`}>
                                    {targetType === 'all' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                </div>
                                <div>
                                    <span className="font-medium text-sm text-gray-900">All Customers</span>
                                    <p className="text-xs text-gray-500">Send to everyone who follows the LINE OA</p>
                                </div>
                            </div>

                            <div className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 ${targetType === 'tags' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                                onClick={() => setTargetType('tags')}
                            >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetType === 'tags' ? 'border-indigo-600' : 'border-gray-400'}`}>
                                    {targetType === 'tags' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium text-sm text-gray-900">Specific Tags</span>
                                    <p className="text-xs text-gray-500">Send only to users with ANY of the selected tags</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {targetType === 'tags' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Tags</label>
                            {loadingTags ? (
                                <div className="text-center py-4 text-gray-500 text-sm">Loading tags...</div>
                            ) : availableTags.length === 0 ? (
                                <div className="text-center py-4 text-gray-500 text-sm">No tags found in system.</div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {availableTags.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => handleToggleTag(tag)}
                                            className={`px-3 py-2 rounded text-sm font-medium border flex items-center justify-between transition-colors ${selectedTags.includes(tag)
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="truncate">{tag}</span>
                                            {selectedTags.includes(tag) && <Tag className="w-3 h-3 ml-1 fill-current" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-2">* Users with at least one matching tag will receive the message.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || (targetType === 'tags' && selectedTags.length === 0)}
                        className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none flex items-center gap-2 ${sending ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {sending ? 'Sending...' : (
                            <>
                                <Send className="w-4 h-4" />
                                Send Broadcast
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
