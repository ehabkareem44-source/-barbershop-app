import React, { useEffect, useState } from 'react';
import { Scissors, Loader2, Check, Users, Clock } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function QueuePage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [myEntryId, setMyEntryId] = useState(
    () => sessionStorage.getItem('myQueueEntryId') || null
  );

  const loadQueue = async () => {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: true });
    if (!error) setQueue(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();
    const channel = supabase
      .channel('queue_public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        loadQueue();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const joinQueue = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError('اكتب اسمك ورقم تليفونك');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('queue_entries')
      .insert({ customer_name: name.trim(), phone: phone.trim(), status: 'waiting' })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      setError('حصل خطأ، حاول تاني');
      return;
    }
    sessionStorage.setItem('myQueueEntryId', data.id);
    setMyEntryId(data.id);
    setName('');
    setPhone('');
    loadQueue();
  };

  const myPosition = myEntryId
    ? queue.filter((q) => q.status === 'waiting').findIndex((q) => q.id === myEntryId) + 1
    : 0;
  const myEntry = queue.find((q) => q.id === myEntryId);

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

      <div style={styles.header}>
        <div style={styles.brandMark}><Scissors size={22} color="#F4EDE1" /></div>
        <h1 style={styles.title}>The Gentleman</h1>
        <p style={styles.subtitle}>احجز مكانك في الدور</p>
      </div>

      {myEntry && myEntry.status === 'waiting' && (
        <div style={styles.myPositionCard}>
          <div style={{ fontSize: 13, color: '#6b6558' }}>مكانك في الدور</div>
          <div style={styles.myPositionNumber}>{myPosition}</div>
          <div style={{ fontSize: 13, color: '#8a8578' }}>
            {myPosition <= 1 ? 'الدور عليك دلوقتي تقريبًا 💈' : `قدامك ${myPosition - 1} زبون`}
          </div>
        </div>
      )}
      {myEntry && myEntry.status === 'in_progress' && (
        <div style={{ ...styles.myPositionCard, background: '#EAF2EA' }}>
          <Check size={22} color="#4A7A4A" />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4A7A4A', marginTop: 6 }}>الدور عليك دلوقتي!</div>
        </div>
      )}

      {(!myEntry || myEntry.status === 'done' || myEntry.status === 'cancelled') && (
        <form onSubmit={joinQueue} style={styles.card}>
          <label style={styles.label}>اسمك</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اكتب اسمك"
          />
          <label style={styles.label}>رقم تليفونك</label>
          <input
            style={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            type="tel"
            inputMode="numeric"
            dir="ltr"
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting ? <Loader2 size={16} className="spin" /> : <Users size={16} />}
            {submitting ? 'جاري الحجز...' : 'احجز مكاني في الدور'}
          </button>
        </form>
      )}

      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <Clock size={16} color="#B5622F" />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>الدور دلوقتي</span>
        </div>
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#8a8578', fontSize: 13.5 }}>جاري التحميل...</div>
        ) : queue.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#8a8578', fontSize: 13.5 }}>مفيش حد في الدور دلوقتي</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.map((q, idx) => (
              <div key={q.id} style={{ ...styles.queueRow, ...(q.id === myEntryId ? styles.queueRowMe : {}) }}>
                <div style={styles.queueNum}>{q.status === 'in_progress' ? '💈' : idx + 1}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
                  {q.customer_name}{q.id === myEntryId ? ' (أنت)' : ''}
                </div>
                {q.status === 'in_progress' && <span style={styles.nowBadge}>عنده دلوقتي</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#F7F3EC',
    fontFamily: "'Tajawal', 'Cairo', sans-serif",
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 },
  brandMark: {
    width: 48, height: 48, borderRadius: 13, background: '#B5622F',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { fontFamily: "'Cairo', sans-serif", fontSize: 22, fontWeight: 800, color: '#2E2A24', margin: 0 },
  subtitle: { fontSize: 13.5, color: '#8a8578', margin: '4px 0 0' },
  myPositionCard: {
    width: '100%', maxWidth: 380, background: '#FBF3EC', border: '1px solid #E7E0D2',
    borderRadius: 16, padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  myPositionNumber: { fontFamily: "'Cairo', sans-serif", fontSize: 40, fontWeight: 800, color: '#B5622F', lineHeight: 1.2 },
  card: {
    width: '100%', maxWidth: 380, background: '#FBF8F2', border: '1px solid #E7E0D2',
    borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column',
  },
  cardHeaderRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#2E2A24' },
  label: { fontSize: 12.5, fontWeight: 600, color: '#6b6558', marginBottom: 6 },
  input: {
    width: '100%', border: '1px solid #E7E0D2', borderRadius: 9, padding: '11px 12px',
    fontSize: 14, background: '#fff', color: '#2E2A24', marginBottom: 14, outline: 'none',
  },
  error: { background: '#FBEAE7', color: '#C0392B', fontSize: 13, padding: '9px 12px', borderRadius: 9, marginBottom: 12 },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: '#B5622F', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 16px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  },
  queueRow: {
    display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
    border: '1px solid #E7E0D2', borderRadius: 10, padding: '9px 12px',
  },
  queueRowMe: { borderColor: '#B5622F', background: '#FBF3EC' },
  queueNum: {
    width: 26, height: 26, borderRadius: '50%', background: '#F3EFE6', color: '#B5622F',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0,
  },
  nowBadge: { fontSize: 11, fontWeight: 700, color: '#4A7A4A', background: '#EAF2EA', padding: '4px 8px', borderRadius: 20 },
};
