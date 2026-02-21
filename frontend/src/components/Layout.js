import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { LogOut, LayoutDashboard, LogIn, ShoppingCart, Home, ClipboardList, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const Layout = ({ children, user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLogin = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: Math.random().toString(36).substring(2),
      prompt: "select_account",
    });
    window.location.href = `${googleAuthUrl}?${params.toString()}`;
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
      toast.success('Logged out successfully');
      if (setUser) setUser(null);
      navigate('/');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  // Helper to dynamically check the active path
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 pb-20">
      
      {/* Top Navigation Bar */}
      <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket</h1>
            <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
          </div>
          <div className="flex items-center gap-4">
            {user?.is_admin && (
              <Button 
                onClick={() => navigate('/admin')} 
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-secondary hidden sm:flex border border-emerald-600"
                size="sm"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Admin Console
              </Button>
            )}
            <div className="text-right flex flex-col items-end justify-center">
              {user ? (
                <>
                  <p className="text-sm font-bold text-white font-secondary">{user.name}</p>
                  <button 
                    onClick={handleLogout} 
                    className="text-xs text-rose-300 hover:text-rose-100 flex items-center mt-1 transition-colors font-secondary"
                  >
                    <LogOut className="h-3 w-3 mr-1" /> Logout
                  </button>
                </>
              ) : (
                <Button onClick={() => setShowLoginModal(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-secondary">
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* Bottom Navigation Strip */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto md:max-w-3xl px-2">
          
          <button 
            onClick={() => navigate('/')} 
            className={`flex flex-col items-center justify-center w-full h-[calc(100%-12px)] my-[6px] mx-1 rounded-lg transition-colors ${isActive('/') ? 'bg-lime-400 text-lime-950 shadow-sm' : 'text-zinc-500 hover:text-lime-700 hover:bg-lime-50'}`}
          >
            <Home className="h-5 w-5 md:h-6 md:w-6 mb-1" />
            <span className="text-[10px] md:text-xs font-bold font-secondary">Home</span>
          </button>
          
          <button 
            onClick={() => user ? navigate('/your-order') : setShowLoginModal(true)} 
            className={`flex flex-col items-center justify-center w-full h-[calc(100%-12px)] my-[6px] mx-1 rounded-lg transition-colors ${isActive('/your-order') ? 'bg-lime-400 text-lime-950 shadow-sm' : 'text-zinc-500 hover:text-lime-700 hover:bg-lime-50'}`}
          >
            <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 mb-1" />
            <span className="text-[10px] md:text-xs font-medium font-secondary">Cart</span>
          </button>
          
          <button 
            onClick={() => user ? navigate('/orders') : setShowLoginModal(true)} 
            className={`flex flex-col items-center justify-center w-full h-[calc(100%-12px)] my-[6px] mx-1 rounded-lg transition-colors ${isActive('/orders') ? 'bg-lime-400 text-lime-950 shadow-sm' : 'text-zinc-500 hover:text-lime-700 hover:bg-lime-50'}`}
          >
            <ClipboardList className="h-5 w-5 md:h-6 md:w-6 mb-1" />
            <span className="text-[10px] md:text-xs font-medium font-secondary">Your Orders</span>
          </button>
          
          <button 
            onClick={() => user ? navigate('/profile') : setShowLoginModal(true)} 
            className={`flex flex-col items-center justify-center w-full h-[calc(100%-12px)] my-[6px] mx-1 rounded-lg transition-colors ${isActive('/profile') ? 'bg-lime-400 text-lime-950 shadow-sm' : 'text-zinc-500 hover:text-lime-700 hover:bg-lime-50'}`}
          >
            <User className="h-5 w-5 md:h-6 md:w-6 mb-1" />
            <span className="text-[10px] md:text-xs font-medium font-secondary">Profile</span>
          </button>
          
        </div>
      </div>

      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold font-primary text-emerald-950">
              Sign in to continue
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 font-secondary">
              Please sign in to access your account and complete your purchases.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <LogIn className="w-8 h-8 text-emerald-900" />
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-emerald-900 hover:bg-emerald-950 text-white h-12 text-base font-primary font-medium"
            >
              Sign in with Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;