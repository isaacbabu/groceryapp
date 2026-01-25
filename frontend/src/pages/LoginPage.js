import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LoginPage = () => {
  const navigate = useNavigate();

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

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center space-y-8 max-w-md px-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold font-primary text-emerald-950 tracking-tight mb-2">
            Emmanuel Supermarket
          </h1>
          <p className="text-xl text-emerald-800 font-secondary font-medium mb-3">
            Online Grocery Shopping
          </p>
          <p className="text-zinc-600 font-secondary text-base italic">
            &ldquo;The products you need, at prices you&apos;ll love, delivered with care.&rdquo;
          </p>
        </div>
        
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
          <div className="mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-emerald-900" />
            </div>
            <h2 className="text-xl font-primary font-bold text-emerald-950 mb-2">
              Sign in to continue
            </h2>
            <p className="text-sm text-zinc-500 font-secondary">
              Use your Google account to access the billing system
            </p>
          </div>
          
          <Button
            data-testid="google-signin-btn"
            onClick={handleLogin}
            className="w-full bg-emerald-900 hover:bg-emerald-950 text-white h-12 text-base font-primary font-medium"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;