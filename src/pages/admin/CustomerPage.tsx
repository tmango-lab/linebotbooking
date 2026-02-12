import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/api';
import { Search, User, Phone, Calendar, Edit2, Check, X, RefreshCw, Plus, Eye } from 'lucide-react';

interface Profile {
    user_id: string;
    team_name: string;
    phone_number: string;
    created_at: string;
    updated_at: string;
    tags?: string[]; // [NEW]
}

export default function CustomerPage() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ team_name: string; phone_number: string } | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState({ team_name: '', phone_number: '' });

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProfiles(data || []);
        } catch (err: any) {
            console.error('Error fetching profiles:', err);
            alert('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (p: Profile) => {
        setEditingId(p.user_id);
        setEditForm({ team_name: p.team_name, phone_number: p.phone_number });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm(null);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editForm) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    team_name: editForm.team_name,
                    phone_number: editForm.phone_number,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', editingId);

            if (error) throw error;

            // Optimistic Update
            setProfiles(prev => prev.map(p => p.user_id === editingId ? { ...p, ...editForm } : p));
            setEditingId(null);
            setEditForm(null);
        } catch (err: any) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleAddClick = () => {
        setAddForm({ team_name: '', phone_number: '' });
        setIsAdding(true);
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
    };

    const handleSaveNew = async () => {
        if (!addForm.team_name || !addForm.phone_number) {
            alert('Please fill in all fields');
            return;
        }
        try {
            // Generate a manual ID
            const newId = `manual_${Date.now()}`;
            const newProfile: Profile = {
                user_id: newId,
                team_name: addForm.team_name,
                phone_number: addForm.phone_number,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('profiles')
                .insert([newProfile]); // Insert as array

            if (error) throw error;

            setProfiles([newProfile, ...profiles]);
            setIsAdding(false);
        } catch (err: any) {
            alert('Failed to add customer: ' + err.message);
        }
    };

    const handleAddTag = async (p: Profile, tag: string) => {
        if (!tag) return;
        const currentTags = p.tags || [];
        if (currentTags.includes(tag)) return;

        const newTags = [...currentTags, tag];
        await updateTags(p, newTags);
    };

    const handleRemoveTag = async (p: Profile, tagToRemove: string) => {
        const currentTags = p.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);
        await updateTags(p, newTags);
    };

    const updateTags = async (p: Profile, newTags: string[]) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ tags: newTags })
                .eq('user_id', p.user_id);

            if (error) throw error;

            // Optimistic update
            setProfiles(prev => prev.map(pr => pr.user_id === p.user_id ? { ...pr, tags: newTags } : pr));
        } catch (err: any) {
            alert('Error updating tags: ' + err.message);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.team_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.phone_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <User className="h-6 w-6" /> Customer Management
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleAddClick}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white border border-transparent rounded hover:bg-indigo-700 text-sm font-medium shadow-sm"
                    >
                        <Plus className="h-4 w-4" /> Add Customer
                    </button>
                    <button
                        onClick={fetchProfiles}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search by Team Name or Phone..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white shadow overflow-hidden rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-200">
                    {loading && profiles.length === 0 ? (
                        <li className="p-4 text-center text-gray-500">Loading...</li>
                    ) : (
                        <>
                            {filteredProfiles.length === 0 ? (
                                <li className="p-4 text-center text-gray-500">No customers found.</li>
                            ) : (
                                filteredProfiles.map((p) => (
                                    <li key={p.user_id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                {editingId === p.user_id && editForm ? (
                                                    // Edit Mode
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500">Team Name</label>
                                                            <input
                                                                type="text"
                                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-2 py-1"
                                                                value={editForm.team_name}
                                                                onChange={e => setEditForm({ ...editForm, team_name: e.target.value })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500">Phone</label>
                                                            <input
                                                                type="text"
                                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-2 py-1"
                                                                value={editForm.phone_number}
                                                                onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Display Mode
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-1 ring-white">
                                                                {p.team_name?.charAt(0) || '?'}
                                                            </div>
                                                            <span
                                                                className="text-sm font-medium text-gray-900 truncate hover:text-indigo-600 cursor-pointer"
                                                                title={p.user_id}
                                                                onClick={() => navigate(`/admin/customers/${p.user_id}`)}
                                                            >
                                                                {p.team_name || 'Unknown Team'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                                            <Phone className="h-4 w-4 text-gray-400" />
                                                            {p.phone_number || '-'}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                                            <Calendar className="h-3 w-3" />
                                                            Registered: {new Date(p.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tags Display */}
                                                <div className="mt-2 flex flex-wrap gap-2 items-center">
                                                    {p.tags?.map(tag => (
                                                        <span key={tag} className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 ${tag === 'vip' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                            tag === 'inactive' ? 'bg-red-100 text-red-800 border-red-200' :
                                                                'bg-gray-100 text-gray-700 border-gray-200'
                                                            }`}>
                                                            {tag}
                                                            <button onClick={() => handleRemoveTag(p, tag)} className="hover:text-red-600 ml-1">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            placeholder="+ tag"
                                                            className="w-16 text-xs border border-gray-300 rounded px-1 py-0.5 focus:w-24 transition-all"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddTag(p, e.currentTarget.value);
                                                                    e.currentTarget.value = '';
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="ml-4 flex items-center gap-2 self-start">
                                                {editingId === p.user_id ? (
                                                    <>
                                                        <button onClick={handleSaveEdit} className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200" title="Save">
                                                            <Check className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={handleCancelEdit} className="p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200" title="Cancel">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => navigate(`/admin/customers/${p.user_id}`)} className="p-1 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View Details">
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleEditClick(p)} className="p-1 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit">
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))
                            )}
                        </>
                    )}
                </ul>
            </div>

            {/* Add Customer Modal */}
            {
                isAdding && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Add New Customer</h2>
                                <button onClick={handleCancelAdd} className="text-gray-400 hover:text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Team Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
                                        value={addForm.team_name}
                                        onChange={e => setAddForm({ ...addForm, team_name: e.target.value })}
                                        placeholder="e.g. Walk-in Team"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
                                        value={addForm.phone_number}
                                        onChange={e => setAddForm({ ...addForm, phone_number: e.target.value })}
                                        placeholder="e.g. 0812345678"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={handleCancelAdd}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveNew}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Save Customer
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

