import React, { useState } from 'react';
import { Scissors, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !password) {
      setError('اكتب رقم التليفون وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      // Normalize the phone number to digits only (strip spaces, dashes, +20, etc.)
      const digitsOnly = phone.trim().replace(/[^\d]/g, '');

      const { data: staffRow, error: staffError } = await supabase
        .from('staff')
        .select('email')
        .eq('username', digitsOnly)
        .maybeSingle();

      if (staffError || !staffRow) {
        setError('رقم التليفون غير مسجل');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: staffRow.email,
        password,
      });

      if (signInError) {
        setError('رقم التليفون أو كلمة المرور غلط');
      }
    } catch (err) {
      setError('حصل خطأ، حاول تاني');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" style={styles.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, button { font-family: 'Tajawal', 'Cairo', sans-serif; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.brandMark}><Scissors size={22} color="#F4EDE1" /></div>
        <h1 style={styles.title}>تسجيل الدخول</h1>
        <p style={styles.subtitle}>ادخل برقم تليفونك وكلمة المرور للوصول للوحة تحكم المحل</p>

        <label style={styles.label}>رقم التليفون</label>
        <input
          style={styles.input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          type="tel"
          inputMode="numeric"
          dir="ltr"
        />

        <label style={styles.label}>كلمة المرور</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.submitBtn} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : null}
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F7F3EC',
    fontFamily: "'Tajawal', 'Cairo', sans-serif",
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#FBF8F2',
    border: '1px solid #E7E0D2',
    borderRadius: 18,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#B5622F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: "'Cairo', sans-serif",
    fontSize: 20,
    fontWeight: 800,
    color: '#2E2A24',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#8a8578',
    margin: '0 0 20px',
    lineHeight: 1.6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#6b6558',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    border: '1px solid #E7E0D2',
    borderRadius: 9,
    padding: '11px 12px',
    fontSize: 14,
    background: '#fff',
    color: '#2E2A24',
    marginBottom: 16,
    outline: 'none',
  },
  error: {
    background: '#FBEAE7',
    color: '#C0392B',
    fontSize: 13,
    padding: '9px 12px',
    borderRadius: 9,
    marginBottom: 14,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#B5622F',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
