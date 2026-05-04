import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Package, 
  Receipt, 
  Users, 
  BookText, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/billing', label: 'Billing', icon: CreditCard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/ledger', label: 'Ledger', icon: BookText },
  { path: '/orders', label: 'Orders', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? '260px' : '0px' }}
        className="relative z-50 flex flex-col bg-white border-r border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 overflow-hidden lg:static"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-neutral-900 dark:text-neutral-50 whitespace-nowrap">
            InventoryGuard
          </span>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' 
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'}
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 mt-auto">
          <Separator className="mb-4" />
          <div className="flex items-center gap-3 mb-4 px-2 overflow-hidden">
            <Avatar className="w-9 h-9 border border-neutral-200 dark:border-neutral-800">
              <AvatarImage src={user?.photoURL || ''} />
              <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
                {profile?.shopName || user?.displayName}
              </p>
              <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </Button>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 truncate capitalize">
              {location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.substring(1).replace('/', ' ')}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Add Notifications or Search here if needed */}
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-neutral-50/50 dark:bg-neutral-950/50">
          <div className="max-w-7xl mx-auto p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
