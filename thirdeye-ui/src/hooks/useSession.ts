'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
}

interface SessionData {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useSession(): SessionData {
  const [sessionData, setSessionData] = useState<SessionData>({
    user: null,
    loading: true,
    error: null
  });
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        
        if (response.ok) {
          const data = await response.json();
          setSessionData({
            user: data.user,
            loading: false,
            error: null
          });
        } else if (response.status === 401) {
          // Not authenticated
          setSessionData({
            user: null,
            loading: false,
            error: null
          });
        } else {
          throw new Error('Failed to check session');
        }
      } catch (error) {
        setSessionData({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    checkSession();
  }, []);

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSessionData({
        user: null,
        loading: false,
        error: null
      });
      router.push('/auth/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return {
    ...sessionData,
    signOut
  };
}

export default useSession;
