import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/api';
import { LogOut, LayoutDashboard, Ticket, User, BarChart3, Receipt } from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate('/admin/login');
        }
        setLoading(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        navigate('/admin/login');
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    const navigation = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Campaigns', href: '/admin/campaigns', icon: Ticket }, // New V2
        { name: 'Customers', href: '/admin/customers', icon: User },
        { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
        { name: 'Promo Codes (V1)', href: '/admin/promo-codes', icon: Ticket }, // Renamed for clarity
        { name: 'Refunds', href: '/admin/refunds', icon: Receipt },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            {/* Sidebar - Dark Modern Style */}
            <aside className="w-72 bg-gray-900 text-white hidden md:flex flex-col shadow-xl z-20">
                {/* Logo Section */}
                <div className="h-20 flex items-center px-8 border-b border-gray-800 bg-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg transform rotate-3">
                            <span className="text-white font-bold text-lg">A</span>
                        </div>
                        <div>
                            <span className="block text-lg font-bold tracking-tight text-white">Admin Panel</span>
                            <span className="block text-xs text-gray-400">System Management</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                        Menu
                    </p>
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <a
                                key={item.name}
                                href={item.href}
                                onClick={(e) => { e.preventDefault(); navigate(item.href); }}
                                className={`
                                    group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                                    ${isActive
                                        ? 'bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={20} className={`${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-white'} transition-colors`} />
                                    {item.name}
                                </div>
                                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
                            </a>
                        );
                    })}
                </nav>

                {/* User Profile / Logout Section */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center border-2 border-gray-700 shadow-inner">
                            <User size={18} className="text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">Administrator</p>
                            <p className="text-xs text-gray-500 truncate">admin@system.com</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all duration-200 group"
                    >
                        <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                        Sign Out
                    </button>

                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-gray-600">v1.0.0 &copy; 2024</p>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
                {/* Mobile Header (Visible only on small screens) */}
                <div className="md:hidden h-16 bg-gray-900 text-white flex items-center px-4 justify-between shadow-md flex-none z-30">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <span className="font-bold text-sm">A</span>
                        </div>
                        <span className="font-bold">Admin Panel</span>
                    </div>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-white">
                        <LogOut size={20} />
                    </button>
                </div>

                {/* Content Outlet */}
                <div className="flex-1 overflow-auto relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
