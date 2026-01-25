import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        const hash = location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token');

        if (!idToken) {
          toast.error('Invalid authentication');
          navigate('/login');
          return;
        }

        const response = await axiosInstance.post('/auth/session', { id_token: idToken });
        const user = response.data.user;

        toast.success(`Welcome, ${user.name}!`);
        navigate('/', { state: { user }, replace: true });
      } catch (error) {
        console.error('Auth error:', error);
        toast.error('Authentication failed');
        navigate('/login');
      }
    };

    processAuth();
  }, [location, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-900 mx-auto"></div>
        <p className="mt-4 text-zinc-600 font-secondary">Authenticating...</p>
      </div>
    </div>
  );
};

export default AuthCallback;