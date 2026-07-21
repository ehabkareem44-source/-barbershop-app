import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import BarbershopSystem from './BarbershopSystem';
import QueuePage from './QueuePage';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out

  // Very small router: /queue is a public page for customers, no login needed.
  const isQueuePage = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/queue';

  useEffect(() => {
    if (isQueuePage) return; // no need to check auth on the public queue page
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [isQueuePage]);

  if (isQueuePage) {
    return <QueuePage />;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F7F3EC', fontFamily: "'Tajawal', sans-serif", color: '#8a8578',
      }}>
        جاري التحقق من الحساب...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <BarbershopSystem session={session} onSignOut={handleSignOut} />;
}
