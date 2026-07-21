import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Scissors, Calendar, Package, DollarSign, Megaphone, ShoppingCart,
  Plus, Trash2, Edit2, X, Check, AlertTriangle, TrendingUp, TrendingDown,
  Clock, Phone, User, Search, MessageCircle, Copy, ChevronRight, ChevronLeft,
  Home, Users, Gift, Send, RefreshCw, Save, LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient';

// ===================== UTILITIES =====================
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n) => `${Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`;
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const weekdayAr = (iso) => {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[new Date(iso).getDay()];
};

const SHOP_ROW_ID = 'default'; // single shared "shop data" row in Supabase

const defaultData = () => ({
  shopName: 'The Gentleman',
  barbers: [
    { id: uid(), name: 'كابتن أحمد', phone: '01000000001', active: true },
    { id: uid(), name: 'كابتن محمود', phone: '01000000002', active: true },
  ],
  services: [
    { id: uid(), name: 'قصة شعر', price: 80, duration: 30 },
    { id: uid(), name: 'حلاقة ذقن', price: 50, duration: 20 },
    { id: uid(), name: 'قصة + ذقن', price: 120, duration: 45 },
    { id: uid(), name: 'صبغة', price: 150, duration: 60 },
  ],
  products: [
    { id: uid(), name: 'جل شعر', qty: 20, minQty: 5, price: 60, cost: 35 },
    { id: uid(), name: 'شمع لحية', qty: 15, minQty: 5, price: 90, cost: 50 },
    { id: uid(), name: 'شامبو', qty: 10, minQty: 3, price: 70, cost: 40 },
  ],
  customers: [
    { id: uid(), name: 'محمد علي', phone: '01111111111', notes: '', birthday: '' },
  ],
  bookings: [],
  sales: [],
  expenses: [],
});

// ===================== APP =====================
export default function BarbershopSystem({ session, onSignOut }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved

  // Guards to avoid our own writes re-triggering the realtime listener,
  // and to avoid the realtime listener firing before initial load finishes.
  const isRemoteUpdate = useRef(false);
  const hasLoaded = useRef(false);

  // Load data from Supabase, creating the shop row if it doesn't exist yet
  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('shop_data')
          .select('data')
          .eq('id', SHOP_ROW_ID)
          .maybeSingle();

        if (error) throw error;

        if (row && row.data) {
          setData(row.data);
        } else {
          const fresh = defaultData();
          const { error: insertError } = await supabase
            .from('shop_data')
            .insert({ id: SHOP_ROW_ID, data: fresh });
          if (insertError) throw insertError;
          setData(fresh);
        }
      } catch (e) {
        console.error('فشل تحميل بيانات الصالون من Supabase:', e);
        setData(defaultData());
      } finally {
        hasLoaded.current = true;
        setLoading(false);
      }
    })();
  }, []);

  // Persist data to Supabase (debounced) whenever it changes locally
  useEffect(() => {
    if (!data || loading) return;
    if (isRemoteUpdate.current) {
      // This change came from another device via realtime; don't re-save it.
      isRemoteUpdate.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('shop_data')
          .update({ data, updated_at: new Date().toISOString() })
          .eq('id', SHOP_ROW_ID);
        if (error) throw error;
        setSaveState('saved');
      } catch (e) {
        console.error('فشل حفظ بيانات الصالون على Supabase:', e);
        setSaveState('idle');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [data, loading]);

  // Listen for changes made by other staff members in real time
  useEffect(() => {
    const channel = supabase
      .channel('shop_data_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shop_data', filter: `id=eq.${SHOP_ROW_ID}` },
        (payload) => {
          if (!hasLoaded.current) return;
          if (payload.new && payload.new.data) {
            isRemoteUpdate.current = true;
            setData(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const update = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { ...next };
    });
  }, []);

  if (loading || !data) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <p style={{ color: '#8a8578', fontFamily: FONT.body, marginTop: 16 }}>جاري تحميل بيانات الصالون...</p>
      </div>
    );
  }

  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'queue', label: 'الدور', icon: Users },
    { id: 'bookings', label: 'الحجزات', icon: Calendar },
    { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
    { id: 'inventory', label: 'المخزن', icon: Package },
    { id: 'accounts', label: 'الحسابات', icon: DollarSign },
    { id: 'marketing', label: 'الدعاية', icon: Megaphone },
    { id: 'settings', label: 'الإعدادات', icon: Scissors },
  ];

  return (
    <div dir="rtl" style={styles.app}>
      <style>{globalCSS}</style>
      {/* Sidebar / Top bar */}
      <div style={styles.shell}>
        <aside style={styles.sidebar} className="sidebar">
          <div style={styles.brandRow}>
            <div style={styles.brandMark}><Scissors size={20} color="#F4EDE1" /></div>
            <div>
              <div style={styles.brandName}>{data.shopName}</div>
              <div style={styles.brandSub}>لوحة التحكم</div>
            </div>
          </div>
          <nav style={styles.nav}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  ...styles.navBtn,
                  ...(tab === item.id ? styles.navBtnActive : {}),
                }}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div style={styles.saveIndicator}>
            {saveState === 'saving' ? (
              <><RefreshCw size={13} className="spin" /> بيتحفظ...</>
            ) : (
              <><Check size={13} color="#7a9b76" /> محفوظ سحابياً</>
            )}
          </div>
          {session && (
            <div style={{ borderTop: '1px solid rgba(244,237,225,0.12)', marginTop: 10, paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, color: '#a8a094', padding: '0 12px', marginBottom: 6, direction: 'ltr', textAlign: 'right' }}>
                {session.user?.email}
              </div>
              <button
                onClick={onSignOut}
                style={{ ...styles.navBtn, color: '#e0a89a' }}
              >
                <LogOut size={17} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </aside>

        {/* Mobile bottom nav */}
        <nav style={styles.mobileNav} className="mobile-nav">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                ...styles.mobileNavBtn,
                ...(tab === item.id ? { color: '#B5622F' } : {}),
              }}
            >
              <item.icon size={20} />
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          ))}
        </nav>

        <main style={styles.main} className="main-content">
          {tab === 'home' && <HomeTab data={data} setTab={setTab} />}
          {tab === 'queue' && <QueueTab data={data} update={update} />}
          {tab === 'bookings' && <BookingsTab data={data} update={update} />}
          {tab === 'sales' && <SalesTab data={data} update={update} />}
          {tab === 'inventory' && <InventoryTab data={data} update={update} />}
          {tab === 'accounts' && <AccountsTab data={data} update={update} />}
          {tab === 'marketing' && <MarketingTab data={data} update={update} />}
          {tab === 'settings' && <SettingsTab data={data} update={update} />}
        </main>
      </div>
    </div>
  );
}

// ===================== HOME =====================
function HomeTab({ data, setTab }) {
  const today = todayISO();
  const todayBookings = data.bookings.filter(b => b.date === today).sort((a,b) => a.time.localeCompare(b.time));
  const todaySales = data.sales.filter(s => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const lowStock = data.products.filter(p => p.qty <= p.minQty);
  const upcomingCount = data.bookings.filter(b => b.date >= today && b.status !== 'cancelled').length;

  return (
    <div style={styles.page}>
      <PageHeader title={`أهلاً بيك 👋`} subtitle={`${weekdayAr(today)}، ${fmtDate(today)}`} />

      <div style={styles.statsGrid}>
        <StatCard icon={Calendar} label="حجزات النهاردة" value={todayBookings.length} color="#B5622F" />
        <StatCard icon={DollarSign} label="مبيعات النهاردة" value={fmtMoney(todayRevenue)} color="#5C7A5C" />
        <StatCard icon={Calendar} label="حجزات قادمة" value={upcomingCount} color="#7B6B9E" />
        <StatCard icon={Package} label="أصناف ناقصة" value={lowStock.length} color={lowStock.length ? "#C0392B" : "#8a8578"} />
      </div>

      <div style={styles.homeGrid}>
        <Card title="حجزات النهاردة" action={<button style={styles.linkBtn} onClick={() => setTab('bookings')}>عرض الكل <ChevronLeft size={14} /></button>}>
          {todayBookings.length === 0 ? (
            <EmptyState text="مفيش حجزات النهاردة لسه" />
          ) : (
            <div style={styles.list}>
              {todayBookings.slice(0, 6).map(b => {
                const barber = data.barbers.find(x => x.id === b.barberId);
                const service = data.services.find(x => x.id === b.serviceId);
                return (
                  <div key={b.id} style={styles.bookingRow}>
                    <div style={styles.timeChip}>{b.time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#2E2A24' }}>{b.customerName}</div>
                      <div style={{ fontSize: 13, color: '#8a8578' }}>{service?.name || '—'} · {barber?.name || '—'}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="تنبيهات المخزن" action={<button style={styles.linkBtn} onClick={() => setTab('inventory')}>عرض الكل <ChevronLeft size={14} /></button>}>
          {lowStock.length === 0 ? (
            <EmptyState text="المخزون كله تمام 👌" />
          ) : (
            <div style={styles.list}>
              {lowStock.map(p => (
                <div key={p.id} style={styles.alertRow}>
                  <AlertTriangle size={16} color="#C0392B" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: '#8a8578' }}>متبقي {p.qty} فقط (الحد الأدنى {p.minQty})</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}18`, color }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

// ===================== QUEUE (الدور) =====================
function QueueTab({ data, update }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const queueLink = typeof window !== 'undefined' ? `${window.location.origin}/queue` : '/queue';

  const loadQueue = async () => {
    const { data: rows, error } = await supabase
      .from('queue_entries')
      .select('*')
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: true });
    if (!error) setQueue(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();
    const channel = supabase
      .channel('queue_staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        loadQueue();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Any customer who joins the queue gets added to the shared customer list
  // automatically, so they show up in the "الدعاية" tab for future offers.
  useEffect(() => {
    if (!data || queue.length === 0) return;
    const existingPhones = new Set(data.customers.map(c => c.phone));
    const hasNew = queue.some(q => q.phone && !existingPhones.has(q.phone));
    if (!hasNew) return;
    update(prev => {
      const known = new Set(prev.customers.map(c => c.phone));
      const toAdd = queue
        .filter(q => q.phone && !known.has(q.phone))
        .map(q => ({ id: uid(), name: q.customer_name, phone: q.phone, notes: '', birthday: '' }));
      if (toAdd.length === 0) return prev;
      return { ...prev, customers: [...prev.customers, ...toAdd] };
    });
  }, [queue, data]);

  const setStatus = async (id, status) => {
    await supabase.from('queue_entries').update({ status }).eq('id', id);
  };
  const remove = async (id) => {
    await supabase.from('queue_entries').delete().eq('id', id);
  };

  const inProgress = queue.filter((q) => q.status === 'in_progress');
  const waiting = queue.filter((q) => q.status === 'waiting');

  const copyLink = () => {
    navigator.clipboard?.writeText(queueLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={styles.page}>
      <PageHeader
        title="الدور"
        subtitle="العملاء بيحجزوا مكانهم بنفسهم من الرابط، وانت بتديره من هنا"
        action={
          <button style={styles.secondaryBtn} onClick={copyLink}>
            <Copy size={16} /> {copied ? 'اتنسخ ✓' : 'رابط الدور للعملاء'}
          </button>
        }
      />

      {loading ? (
        <Card><EmptyState text="جاري التحميل..." /></Card>
      ) : queue.length === 0 ? (
        <Card><EmptyState text="مفيش حد في الدور دلوقتي" /></Card>
      ) : (
        <div style={styles.list}>
          {inProgress.map((q) => (
            <div key={q.id} style={{ ...styles.bookingCard, borderColor: '#c9e0c9', background: '#F5FAF5' }}>
              <div style={{ ...styles.timeChipBig, background: '#EAF2EA', color: '#4A7A4A' }}>عنده</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#2E2A24', fontSize: 15 }}>{q.customer_name}</div>
                <div style={{ fontSize: 13, color: '#8a8578', marginTop: 2 }}>{q.phone}</div>
              </div>
              <button style={styles.primaryBtn} onClick={() => setStatus(q.id, 'done')}>
                <Check size={16} /> خلص
              </button>
              <IconBtn onClick={() => remove(q.id)} title="حذف" danger><Trash2 size={15} /></IconBtn>
            </div>
          ))}
          {waiting.map((q, idx) => (
            <div key={q.id} style={styles.bookingCard}>
              <div style={styles.timeChipBig}>{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#2E2A24', fontSize: 15 }}>{q.customer_name}</div>
                <div style={{ fontSize: 13, color: '#8a8578', marginTop: 2 }}>{q.phone}</div>
              </div>
              {inProgress.length === 0 && (
                <button style={styles.primaryBtn} onClick={() => setStatus(q.id, 'in_progress')}>
                  <Scissors size={16} /> ادّيله دوره
                </button>
              )}
              <button style={styles.ghostBtn} onClick={() => setStatus(q.id, 'cancelled')}>إلغاء</button>
              <IconBtn onClick={() => remove(q.id)} title="حذف" danger><Trash2 size={15} /></IconBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== BOOKINGS =====================
function BookingsTab({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterDate, setFilterDate] = useState(todayISO());
  const [showShareLink, setShowShareLink] = useState(false);

  const emptyForm = {
    customerName: '', phone: '', serviceId: data.services[0]?.id || '', barberId: data.barbers[0]?.id || '',
    date: todayISO(), time: '10:00', status: 'confirmed', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  const filtered = data.bookings.filter(b => b.date === filterDate).sort((a, b) => a.time.localeCompare(b.time));

  const openNew = () => { setForm({ ...emptyForm, date: filterDate }); setEditingId(null); setShowForm(true); };
  const openEdit = (b) => { setForm(b); setEditingId(b.id); setShowForm(true); };

  const saveBooking = () => {
    if (!form.customerName.trim()) return;
    update(prev => {
      const bookings = editingId
        ? prev.bookings.map(b => b.id === editingId ? { ...form, id: editingId } : b)
        : [...prev.bookings, { ...form, id: uid() }];
      // auto-add customer if new
      let customers = prev.customers;
      if (form.phone && !customers.some(c => c.phone === form.phone)) {
        customers = [...customers, { id: uid(), name: form.customerName, phone: form.phone, notes: '', birthday: '' }];
      }
      return { ...prev, bookings, customers };
    });
    setShowForm(false);
  };

  const deleteBooking = (id) => {
    update(prev => ({ ...prev, bookings: prev.bookings.filter(b => b.id !== id) }));
  };

  const setStatus = (id, status) => {
    update(prev => ({ ...prev, bookings: prev.bookings.map(b => b.id === id ? { ...b, status } : b) }));
  };

  const shiftDate = (delta) => {
    const d = new Date(filterDate);
    d.setDate(d.getDate() + delta);
    setFilterDate(d.toISOString().slice(0, 10));
  };

  const bookingLink = `https://booking.example.com/${encodeURIComponent(data.shopName)}`;

  return (
    <div style={styles.page}>
      <PageHeader
        title="الحجزات"
        subtitle="إدارة مواعيد العملاء"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={styles.secondaryBtn} onClick={() => setShowShareLink(true)}>
              <Send size={16} /> رابط حجز للعميل
            </button>
            <button style={styles.primaryBtn} onClick={openNew}>
              <Plus size={16} /> حجز جديد
            </button>
          </div>
        }
      />

      <div style={styles.dateNav}>
        <button style={styles.dateNavBtn} onClick={() => shiftDate(-1)}><ChevronRight size={18} /></button>
        <div style={styles.dateNavLabel}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={styles.dateInput} />
          <span style={{ color: '#8a8578', fontSize: 14 }}>{weekdayAr(filterDate)}</span>
        </div>
        <button style={styles.dateNavBtn} onClick={() => shiftDate(1)}><ChevronLeft size={18} /></button>
        <button style={{ ...styles.dateNavBtn, marginRight: 8 }} onClick={() => setFilterDate(todayISO())}>النهاردة</button>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState text="مفيش حجزات في اليوم ده" /></Card>
      ) : (
        <div style={styles.list}>
          {filtered.map(b => {
            const barber = data.barbers.find(x => x.id === b.barberId);
            const service = data.services.find(x => x.id === b.serviceId);
            return (
              <div key={b.id} style={styles.bookingCard}>
                <div style={styles.timeChipBig}>{b.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#2E2A24', fontSize: 15 }}>{b.customerName}</div>
                  <div style={{ fontSize: 13, color: '#8a8578', marginTop: 2 }}>{service?.name || '—'} · {barber?.name || '—'} {b.phone && `· ${b.phone}`}</div>
                  {b.notes && <div style={{ fontSize: 12, color: '#a89f8f', marginTop: 2 }}>{b.notes}</div>}
                </div>
                <StatusBadge status={b.status} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {b.status !== 'done' && (
                    <IconBtn onClick={() => setStatus(b.id, 'done')} title="تم"><Check size={15} /></IconBtn>
                  )}
                  <IconBtn onClick={() => openEdit(b)} title="تعديل"><Edit2 size={15} /></IconBtn>
                  <IconBtn onClick={() => deleteBooking(b.id)} title="حذف" danger><Trash2 size={15} /></IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editingId ? 'تعديل الحجز' : 'حجز جديد'}>
          <FormField label="اسم العميل">
            <input style={styles.input} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="اسم العميل" />
          </FormField>
          <FormField label="رقم التليفون">
            <input style={styles.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" />
          </FormField>
          <div style={styles.formRow}>
            <FormField label="الخدمة">
              <select style={styles.input} value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })}>
                {data.services.map(s => <option key={s.id} value={s.id}>{s.name} — {fmtMoney(s.price)}</option>)}
              </select>
            </FormField>
            <FormField label="الحلاق">
              <select style={styles.input} value={form.barberId} onChange={e => setForm({ ...form, barberId: e.target.value })}>
                {data.barbers.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormField>
          </div>
          <div style={styles.formRow}>
            <FormField label="التاريخ">
              <input type="date" style={styles.input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </FormField>
            <FormField label="الساعة">
              <input type="time" style={styles.input} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </FormField>
          </div>
          <FormField label="ملاحظات">
            <input style={styles.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="اختياري" />
          </FormField>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={saveBooking}><Save size={16} /> حفظ الحجز</button>
            <button style={styles.ghostBtn} onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showShareLink && (
        <Modal onClose={() => setShowShareLink(false)} title="رابط حجز للعميل">
          <p style={{ color: '#6b6558', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            ده مثال لرابط حجز مستقل ممكن تحطه في بيو انستجرام أو تبعته في واتساب عشان العميل يحجز بنفسه. (لتفعيل رابط حقيقي شغال، محتاج ربط بمنصة حجوزات فعلية أو استضافة سيستم كامل).
          </p>
          <div style={styles.linkBox}>
            <span style={{ flex: 1, fontSize: 13, color: '#5a544a', direction: 'ltr', textAlign: 'left' }}>{bookingLink}</span>
            <IconBtn onClick={() => navigator.clipboard?.writeText(bookingLink)} title="نسخ"><Copy size={15} /></IconBtn>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>نص جاهز للإرسال:</div>
            <div style={styles.textBlock}>
              احجز ميعادك في {data.shopName} بضغطة واحدة 💈{'\n'}{bookingLink}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    confirmed: { label: 'مؤكد', bg: '#EAF2EA', color: '#4A7A4A' },
    done: { label: 'تم', bg: '#E9E5DD', color: '#7a7466' },
    cancelled: { label: 'ملغي', bg: '#F7E7E4', color: '#C0392B' },
  };
  const s = map[status] || map.confirmed;
  return <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>;
}

// ===================== SALES =====================
function SalesTab({ data, update }) {
  const [cart, setCart] = useState([]); // {type:'service'|'product', id, name, price, qty}
  const [customerName, setCustomerName] = useState('');
  const [barberId, setBarberId] = useState(data.barbers[0]?.id || '');
  const [discount, setDiscount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const addToCart = (type, item) => {
    setCart(prev => {
      const existing = prev.find(c => c.type === type && c.id === item.id);
      if (existing) {
        return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { type, id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const updateQty = (idx, delta) => {
    setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
  };
  const removeFromCart = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const checkout = () => {
    if (cart.length === 0) return;
    update(prev => {
      // reduce product stock
      let products = prev.products;
      cart.forEach(item => {
        if (item.type === 'product') {
          products = products.map(p => p.id === item.id ? { ...p, qty: Math.max(0, p.qty - item.qty) } : p);
        }
      });
      const sale = {
        id: uid(), date: todayISO(), time: new Date().toTimeString().slice(0, 5),
        customerName: customerName || 'عميل', barberId, items: cart, subtotal, discount: Number(discount || 0), total,
      };
      return { ...prev, products, sales: [...prev.sales, sale] };
    });
    setCart([]); setCustomerName(''); setDiscount(0);
  };

  const todaySales = data.sales.filter(s => s.date === todayISO()).sort((a,b) => b.time.localeCompare(a.time));

  return (
    <div style={styles.page}>
      <PageHeader title="المبيعات" subtitle="فاتورة سريعة للخدمات والمنتجات"
        action={<button style={styles.secondaryBtn} onClick={() => setHistoryOpen(true)}><Clock size={16} /> سجل النهاردة</button>}
      />

      <div style={styles.salesGrid}>
        <div>
          <Card title="الخدمات">
            <div style={styles.chipGrid}>
              {data.services.map(s => (
                <button key={s.id} style={styles.itemChip} onClick={() => addToCart('service', s)}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: '#8a8578' }}>{fmtMoney(s.price)}</span>
                </button>
              ))}
            </div>
          </Card>
          <div style={{ height: 16 }} />
          <Card title="المنتجات">
            <div style={styles.chipGrid}>
              {data.products.map(p => (
                <button key={p.id} style={{ ...styles.itemChip, opacity: p.qty <= 0 ? 0.4 : 1 }} onClick={() => p.qty > 0 && addToCart('product', p)} disabled={p.qty <= 0}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: '#8a8578' }}>{fmtMoney(p.price)} {p.qty <= 0 && '· خلص'}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card title="الفاتورة">
          <FormField label="اسم العميل">
            <input style={styles.input} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="اختياري" />
          </FormField>
          <FormField label="الحلاق">
            <select style={styles.input} value={barberId} onChange={e => setBarberId(e.target.value)}>
              {data.barbers.filter(b=>b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FormField>

          {cart.length === 0 ? (
            <EmptyState text="اختار خدمة أو منتج عشان تبدأ الفاتورة" />
          ) : (
            <div style={styles.cartList}>
              {cart.map((c, idx) => (
                <div key={idx} style={styles.cartRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#8a8578' }}>{fmtMoney(c.price)} × {c.qty}</div>
                  </div>
                  <div style={styles.qtyControl}>
                    <button style={styles.qtyBtn} onClick={() => updateQty(idx, -1)}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{c.qty}</span>
                    <button style={styles.qtyBtn} onClick={() => updateQty(idx, 1)}>+</button>
                  </div>
                  <IconBtn onClick={() => removeFromCart(idx)} danger><X size={14} /></IconBtn>
                </div>
              ))}
            </div>
          )}

          <FormField label="خصم (ج.م)">
            <input type="number" style={styles.input} value={discount} onChange={e => setDiscount(e.target.value)} />
          </FormField>

          <div style={styles.totalRow}>
            <span>الإجمالي</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#B5622F' }}>{fmtMoney(total)}</span>
          </div>

          <button style={{ ...styles.primaryBtn, width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={checkout} disabled={cart.length === 0}>
            <Check size={16} /> إتمام البيع
          </button>
        </Card>
      </div>

      {historyOpen && (
        <Modal onClose={() => setHistoryOpen(false)} title="مبيعات النهاردة">
          {todaySales.length === 0 ? <EmptyState text="لسه مفيش مبيعات النهاردة" /> : (
            <div style={styles.list}>
              {todaySales.map(s => (
                <div key={s.id} style={styles.saleHistRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.customerName} · {s.time}</div>
                    <div style={{ fontSize: 12, color: '#8a8578' }}>{s.items.map(i => i.name).join('، ')}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#5C7A5C' }}>{fmtMoney(s.total)}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ===================== INVENTORY =====================
function InventoryTab({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = { name: '', qty: 0, minQty: 5, price: 0, cost: 0 };
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (p) => { setForm(p); setEditingId(p.id); setShowForm(true); };

  const save = () => {
    if (!form.name.trim()) return;
    update(prev => ({
      ...prev,
      products: editingId
        ? prev.products.map(p => p.id === editingId ? { ...form, id: editingId, qty: Number(form.qty), minQty: Number(form.minQty), price: Number(form.price), cost: Number(form.cost) } : p)
        : [...prev.products, { ...form, id: uid(), qty: Number(form.qty), minQty: Number(form.minQty), price: Number(form.price), cost: Number(form.cost) }]
    }));
    setShowForm(false);
  };
  const remove = (id) => update(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
  const adjustQty = (id, delta) => update(prev => ({ ...prev, products: prev.products.map(p => p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p) }));

  const filtered = data.products.filter(p => p.name.includes(search));
  const totalValue = data.products.reduce((s, p) => s + p.qty * p.cost, 0);

  return (
    <div style={styles.page}>
      <PageHeader title="المخزن" subtitle="إدارة المنتجات والكميات"
        action={<button style={styles.primaryBtn} onClick={openNew}><Plus size={16} /> صنف جديد</button>}
      />

      <div style={styles.statsGrid}>
        <StatCard icon={Package} label="عدد الأصناف" value={data.products.length} color="#B5622F" />
        <StatCard icon={AlertTriangle} label="أصناف ناقصة" value={data.products.filter(p => p.qty <= p.minQty).length} color="#C0392B" />
        <StatCard icon={DollarSign} label="قيمة المخزون" value={fmtMoney(totalValue)} color="#5C7A5C" />
      </div>

      <div style={styles.searchBar}>
        <Search size={16} color="#a89f8f" />
        <input style={styles.searchInput} placeholder="دور على صنف..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={styles.list}>
        {filtered.map(p => {
          const low = p.qty <= p.minQty;
          return (
            <div key={p.id} style={{ ...styles.productRow, ...(low ? { borderColor: '#E8C4BC' } : {}) }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#2E2A24' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#8a8578', marginTop: 2 }}>
                  بيع {fmtMoney(p.price)} · تكلفة {fmtMoney(p.cost)} · الحد الأدنى {p.minQty}
                </div>
              </div>
              <div style={styles.qtyControl}>
                <button style={styles.qtyBtn} onClick={() => adjustQty(p.id, -1)}>−</button>
                <span style={{ minWidth: 30, textAlign: 'center', fontWeight: 700, color: low ? '#C0392B' : '#2E2A24' }}>{p.qty}</span>
                <button style={styles.qtyBtn} onClick={() => adjustQty(p.id, 1)}>+</button>
              </div>
              <IconBtn onClick={() => openEdit(p)} title="تعديل"><Edit2 size={15} /></IconBtn>
              <IconBtn onClick={() => remove(p.id)} title="حذف" danger><Trash2 size={15} /></IconBtn>
            </div>
          );
        })}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editingId ? 'تعديل الصنف' : 'صنف جديد'}>
          <FormField label="اسم الصنف">
            <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <div style={styles.formRow}>
            <FormField label="الكمية الحالية">
              <input type="number" style={styles.input} value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            </FormField>
            <FormField label="الحد الأدنى للتنبيه">
              <input type="number" style={styles.input} value={form.minQty} onChange={e => setForm({ ...form, minQty: e.target.value })} />
            </FormField>
          </div>
          <div style={styles.formRow}>
            <FormField label="سعر البيع">
              <input type="number" style={styles.input} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </FormField>
            <FormField label="سعر التكلفة">
              <input type="number" style={styles.input} value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            </FormField>
          </div>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={save}><Save size={16} /> حفظ</button>
            <button style={styles.ghostBtn} onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== ACCOUNTS =====================
function AccountsTab({ data, update }) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({ title: '', amount: '', date: todayISO(), category: 'أخرى' });
  const [range, setRange] = useState('month'); // today | week | month

  const inRange = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (range === 'today') return dateStr === todayISO();
    if (range === 'week') {
      const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    const monthAgo = new Date(); monthAgo.setDate(now.getDate() - 30);
    return d >= monthAgo;
  };

  const sales = data.sales.filter(s => inRange(s.date));
  const expenses = data.expenses.filter(e => inRange(e.date));
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const productCost = sales.reduce((sum, sale) => sum + sale.items.reduce((s, item) => {
    if (item.type === 'product') {
      const p = data.products.find(pp => pp.id === item.id);
      return s + (p ? p.cost * item.qty : 0);
    }
    return s;
  }, 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = revenue - productCost - totalExpenses;

  const addExpense = () => {
    if (!expForm.title.trim() || !expForm.amount) return;
    update(prev => ({ ...prev, expenses: [...prev.expenses, { ...expForm, id: uid(), amount: Number(expForm.amount) }] }));
    setExpForm({ title: '', amount: '', date: todayISO(), category: 'أخرى' });
    setShowExpenseForm(false);
  };
  const removeExpense = (id) => update(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));

  // barber performance
  const barberStats = data.barbers.map(b => {
    const bs = sales.filter(s => s.barberId === b.id);
    return { ...b, count: bs.length, total: bs.reduce((s, x) => s + x.total, 0) };
  }).sort((a, b) => b.total - a.total);

  const rangeLabels = { today: 'النهاردة', week: 'آخر أسبوع', month: 'آخر شهر' };

  return (
    <div style={styles.page}>
      <PageHeader title="الحسابات" subtitle="تقارير الإيرادات والمصاريف والأرباح" />

      <div style={styles.tabPills}>
        {['today', 'week', 'month'].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ ...styles.pill, ...(range === r ? styles.pillActive : {}) }}>
            {rangeLabels[r]}
          </button>
        ))}
      </div>

      <div style={styles.statsGrid}>
        <StatCard icon={TrendingUp} label="الإيرادات" value={fmtMoney(revenue)} color="#5C7A5C" />
        <StatCard icon={TrendingDown} label="المصاريف" value={fmtMoney(totalExpenses + productCost)} color="#C0392B" />
        <StatCard icon={DollarSign} label="صافي الربح" value={fmtMoney(netProfit)} color="#B5622F" />
        <StatCard icon={ShoppingCart} label="عدد الفواتير" value={sales.length} color="#7B6B9E" />
      </div>

      <div style={styles.homeGrid}>
        <Card title="أداء الحلاقين">
          {barberStats.length === 0 ? <EmptyState text="مفيش بيانات كفاية" /> : (
            <div style={styles.list}>
              {barberStats.map(b => (
                <div key={b.id} style={styles.barberRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: '#8a8578' }}>{b.count} فاتورة</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#5C7A5C' }}>{fmtMoney(b.total)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="المصاريف" action={<button style={styles.linkBtn} onClick={() => setShowExpenseForm(true)}><Plus size={14} /> إضافة</button>}>
          {expenses.length === 0 ? <EmptyState text="مفيش مصاريف مسجلة في الفترة دي" /> : (
            <div style={styles.list}>
              {expenses.slice().reverse().map(e => (
                <div key={e.id} style={styles.expenseRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: '#8a8578' }}>{e.category} · {fmtDate(e.date)}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#C0392B' }}>-{fmtMoney(e.amount)}</div>
                  <IconBtn onClick={() => removeExpense(e.id)} danger><Trash2 size={14} /></IconBtn>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showExpenseForm && (
        <Modal onClose={() => setShowExpenseForm(false)} title="مصروف جديد">
          <FormField label="بيان المصروف">
            <input style={styles.input} value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} placeholder="مثال: إيجار، فاتورة كهرباء" />
          </FormField>
          <div style={styles.formRow}>
            <FormField label="المبلغ">
              <input type="number" style={styles.input} value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
            </FormField>
            <FormField label="التاريخ">
              <input type="date" style={styles.input} value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} />
            </FormField>
          </div>
          <FormField label="التصنيف">
            <select style={styles.input} value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
              {['إيجار', 'فواتير', 'رواتب', 'مشتريات', 'صيانة', 'أخرى'].map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={addExpense}><Save size={16} /> حفظ</button>
            <button style={styles.ghostBtn} onClick={() => setShowExpenseForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== MARKETING =====================
const TEMPLATES = [
  { id: 'promo', label: 'عرض ترويجي', icon: Megaphone, text: (shop) => `يلا بينا! عرض خاص في ${shop} 💈\nخصم 20% على كل الخدمات الأسبوع ده بس.\nاحجز مكانك دلوقتي!` },
  { id: 'reminder', label: 'تذكير بالحجز', icon: Clock, text: (shop, name, time) => `أهلاً ${name || 'حبيبنا'} 👋\nتذكير بميعادك في ${shop} الساعة ${time || '—'}.\nمستنينك!` },
  { id: 'birthday', label: 'تهنئة عيد ميلاد', icon: Gift, text: (shop, name) => `كل سنة وانت طيب يا ${name || 'صديقنا'} 🎉\nهدية مننا في ${shop}: خصم 15% على أي خدمة الأسبوع ده احتفالاً بعيد ميلادك!` },
  { id: 'winback', label: 'عميل غايب بقاله فترة', icon: Users, text: (shop, name) => `وحشتنا يا ${name || 'صديقنا'} 💈\nمن زمان ما شوفناك في ${shop}. تعالى زورنا، في حاجات جديدة مستنياك!` },
  { id: 'thanks', label: 'شكراً بعد الزيارة', icon: Check, text: (shop, name) => `شكراً ${name || 'يا فندم'} لزيارتك ${shop} 🙏\nتشرفنا بيك، ومستنيينك تاني قريب!` },
];

function MarketingTab({ data, update }) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customText, setCustomText] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [custForm, setCustForm] = useState({ name: '', phone: '', birthday: '', notes: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = selectedTemplate.text(data.shopName, selectedCustomer?.name, '');
    setCustomText(t);
  }, [selectedTemplate, selectedCustomer, data.shopName]);

  const filteredCustomers = data.customers.filter(c => c.name.includes(search) || c.phone.includes(search));

  const openWhatsapp = () => {
    const phone = selectedCustomer?.phone?.replace(/[^0-9]/g, '') || '';
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone; // Egypt default
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(customText)}`;
    window.open(url, '_blank');
  };

  const saveCustomer = () => {
    if (!custForm.name.trim()) return;
    update(prev => ({ ...prev, customers: [...prev.customers, { ...custForm, id: uid() }] }));
    setCustForm({ name: '', phone: '', birthday: '', notes: '' });
    setShowCustomerForm(false);
  };
  const removeCustomer = (id) => update(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));

  return (
    <div style={styles.page}>
      <PageHeader title="الدعاية والرسائل" subtitle="قوالب جاهزة وإرسال مباشر عبر واتساب" />

      <div style={styles.salesGrid}>
        <div>
          <Card title="اختار القالب">
            <div style={styles.templateGrid}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t)} style={{ ...styles.templateCard, ...(selectedTemplate.id === t.id ? styles.templateCardActive : {}) }}>
                  <t.icon size={18} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="نص الرسالة">
            <textarea style={styles.textarea} value={customText} onChange={e => setCustomText(e.target.value)} rows={5} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={openWhatsapp} disabled={!selectedCustomer}>
                <MessageCircle size={16} /> إرسال واتساب
              </button>
              <button style={styles.secondaryBtn} onClick={() => navigator.clipboard?.writeText(customText)}>
                <Copy size={16} /> نسخ النص
              </button>
            </div>
            {!selectedCustomer && <div style={{ fontSize: 12, color: '#a89f8f', marginTop: 8 }}>اختار عميل من القايمة عشان تقدر تبعت واتساب</div>}
          </Card>
        </div>

        <Card title="العملاء" action={<button style={styles.linkBtn} onClick={() => setShowCustomerForm(true)}><Plus size={14} /> عميل جديد</button>}>
          <div style={styles.searchBar}>
            <Search size={15} color="#a89f8f" />
            <input style={styles.searchInput} placeholder="دور بالاسم أو الرقم..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={styles.list}>
            {filteredCustomers.map(c => (
              <button key={c.id} onClick={() => setSelectedCustomer(c)} style={{ ...styles.customerRow, ...(selectedCustomer?.id === c.id ? styles.customerRowActive : {}) }}>
                <div style={styles.avatarCircle}><User size={14} /></div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#8a8578' }}>{c.phone || 'بدون رقم'}</div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); removeCustomer(c.id); }} style={{ padding: 4 }}>
                  <Trash2 size={13} color="#C0392B" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {showCustomerForm && (
        <Modal onClose={() => setShowCustomerForm(false)} title="عميل جديد">
          <FormField label="الاسم">
            <input style={styles.input} value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} />
          </FormField>
          <FormField label="رقم التليفون">
            <input style={styles.input} value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} placeholder="01xxxxxxxxx" />
          </FormField>
          <FormField label="تاريخ الميلاد">
            <input type="date" style={styles.input} value={custForm.birthday} onChange={e => setCustForm({ ...custForm, birthday: e.target.value })} />
          </FormField>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={saveCustomer}><Save size={16} /> حفظ</button>
            <button style={styles.ghostBtn} onClick={() => setShowCustomerForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== SETTINGS =====================
function SettingsTab({ data, update }) {
  const [shopName, setShopName] = useState(data.shopName);
  const [showBarberForm, setShowBarberForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [barberForm, setBarberForm] = useState({ name: '', phone: '', active: true });
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', duration: 30 });

  const saveShopName = () => update(prev => ({ ...prev, shopName }));
  const addBarber = () => {
    if (!barberForm.name.trim()) return;
    update(prev => ({ ...prev, barbers: [...prev.barbers, { ...barberForm, id: uid() }] }));
    setBarberForm({ name: '', phone: '', active: true });
    setShowBarberForm(false);
  };
  const toggleBarber = (id) => update(prev => ({ ...prev, barbers: prev.barbers.map(b => b.id === id ? { ...b, active: !b.active } : b) }));
  const removeBarber = (id) => update(prev => ({ ...prev, barbers: prev.barbers.filter(b => b.id !== id) }));

  const addService = () => {
    if (!serviceForm.name.trim() || !serviceForm.price) return;
    update(prev => ({ ...prev, services: [...prev.services, { ...serviceForm, id: uid(), price: Number(serviceForm.price), duration: Number(serviceForm.duration) }] }));
    setServiceForm({ name: '', price: '', duration: 30 });
    setShowServiceForm(false);
  };
  const removeService = (id) => update(prev => ({ ...prev, services: prev.services.filter(s => s.id !== id) }));

  return (
    <div style={styles.page}>
      <PageHeader title="الإعدادات" subtitle="بيانات الصالون والحلاقين والخدمات" />

      <Card title="اسم الصالون">
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...styles.input, flex: 1 }} value={shopName} onChange={e => setShopName(e.target.value)} />
          <button style={styles.primaryBtn} onClick={saveShopName}><Save size={16} /> حفظ</button>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="الحلاقين" action={<button style={styles.linkBtn} onClick={() => setShowBarberForm(true)}><Plus size={14} /> إضافة</button>}>
        <div style={styles.list}>
          {data.barbers.map(b => (
            <div key={b.id} style={styles.barberSettingRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: '#8a8578' }}>{b.phone}</div>
              </div>
              <button style={{ ...styles.toggleBtn, ...(b.active ? styles.toggleBtnActive : {}) }} onClick={() => toggleBarber(b.id)}>
                {b.active ? 'شغال' : 'متوقف'}
              </button>
              <IconBtn onClick={() => removeBarber(b.id)} danger><Trash2 size={14} /></IconBtn>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="الخدمات" action={<button style={styles.linkBtn} onClick={() => setShowServiceForm(true)}><Plus size={14} /> إضافة</button>}>
        <div style={styles.list}>
          {data.services.map(s => (
            <div key={s.id} style={styles.barberSettingRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#8a8578' }}>{fmtMoney(s.price)} · {s.duration} دقيقة</div>
              </div>
              <IconBtn onClick={() => removeService(s.id)} danger><Trash2 size={14} /></IconBtn>
            </div>
          ))}
        </div>
      </Card>

      {showBarberForm && (
        <Modal onClose={() => setShowBarberForm(false)} title="حلاق جديد">
          <FormField label="الاسم">
            <input style={styles.input} value={barberForm.name} onChange={e => setBarberForm({ ...barberForm, name: e.target.value })} />
          </FormField>
          <FormField label="رقم التليفون">
            <input style={styles.input} value={barberForm.phone} onChange={e => setBarberForm({ ...barberForm, phone: e.target.value })} />
          </FormField>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={addBarber}><Save size={16} /> حفظ</button>
            <button style={styles.ghostBtn} onClick={() => setShowBarberForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showServiceForm && (
        <Modal onClose={() => setShowServiceForm(false)} title="خدمة جديدة">
          <FormField label="اسم الخدمة">
            <input style={styles.input} value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
          </FormField>
          <div style={styles.formRow}>
            <FormField label="السعر">
              <input type="number" style={styles.input} value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })} />
            </FormField>
            <FormField label="المدة (دقيقة)">
              <input type="number" style={styles.input} value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: e.target.value })} />
            </FormField>
          </div>
          <div style={styles.modalActions}>
            <button style={styles.primaryBtn} onClick={addService}><Save size={16} /> حفظ</button>
            <button style={styles.ghostBtn} onClick={() => setShowServiceForm(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== SHARED UI =====================
function PageHeader({ title, subtitle, action }) {
  return (
    <div style={styles.pageHeader}>
      <div>
        <h1 style={styles.pageTitle}>{title}</h1>
        {subtitle && <p style={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Card({ title, action, children }) {
  return (
    <div style={styles.card}>
      {title && (
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.emptyState}>{text}</div>;
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ ...styles.iconBtn, ...(danger ? styles.iconBtnDanger : {}) }}
    >
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2E2A24' }}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ===================== DESIGN TOKENS & STYLES =====================
const FONT = {
  display: "'Cairo', 'Tajawal', sans-serif",
  body: "'Tajawal', 'Cairo', sans-serif",
};

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
input, select, textarea, button { font-family: ${FONT.body}; }
::placeholder { color: #b8b0a0; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
.mobile-nav { display: none; }
@media (max-width: 860px) {
  .sidebar { display: none !important; }
  .mobile-nav { display: flex !important; }
  .main-content { padding-bottom: 84px !important; }
}
input:focus, select:focus, textarea:focus, button:focus-visible {
  outline: 2px solid #B5622F;
  outline-offset: 1px;
}
`;

const COLORS = {
  bg: '#F7F3EC',
  cream: '#FBF8F2',
  ink: '#2E2A24',
  inkSoft: '#6b6558',
  muted: '#8a8578',
  border: '#E7E0D2',
  rust: '#B5622F',
  rustDark: '#9A4F24',
  sage: '#5C7A5C',
};

const styles = {
  app: { minHeight: '100vh', background: COLORS.bg, fontFamily: FONT.body, color: COLORS.ink },
  loadingScreen: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: COLORS.bg },
  loadingSpinner: { width: 36, height: 36, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.rust, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 240, background: '#221D18', color: '#F4EDE1', display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'sticky', top: 0, height: '100vh' },
  brandRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px', borderBottom: '1px solid rgba(244,237,225,0.12)', marginBottom: 20 },
  brandMark: { width: 38, height: 38, borderRadius: 10, background: COLORS.rust, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName: { fontFamily: FONT.display, fontWeight: 800, fontSize: 16, lineHeight: 1.2 },
  brandSub: { fontSize: 12, color: '#a8a094', marginTop: 2 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, background: 'transparent', border: 'none', color: '#d8d1c3', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'right', width: '100%', transition: 'all .15s' },
  navBtnActive: { background: COLORS.rust, color: '#fff', fontWeight: 700 },
  saveIndicator: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a8a094', padding: '8px 12px' },
  mobileNav: { display: 'none', position: 'fixed', bottom: 0, right: 0, left: 0, background: '#fff', borderTop: `1px solid ${COLORS.border}`, padding: '8px 4px', justifyContent: 'space-around', zIndex: 50 },
  mobileNavBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: '#a8a094', padding: '4px 8px', cursor: 'pointer' },
  main: { flex: 1, padding: '32px 28px', overflowX: 'hidden' },
  page: { maxWidth: 1100, margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  pageTitle: { fontFamily: FONT.display, fontSize: 26, fontWeight: 800, margin: 0, color: COLORS.ink },
  pageSubtitle: { fontSize: 14, color: COLORS.muted, margin: '4px 0 0' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 },
  statCard: { background: COLORS.cream, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 14 },
  statIcon: { width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { fontSize: 20, fontWeight: 800, color: COLORS.ink, fontFamily: FONT.display },
  statLabel: { fontSize: 12.5, color: COLORS.muted, marginTop: 2 },
  homeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  salesGrid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' },
  card: { background: COLORS.cream, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15.5, fontWeight: 700, margin: 0, color: COLORS.ink, fontFamily: FONT.display },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: COLORS.rust, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: COLORS.rust, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: COLORS.ink, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
  ghostBtn: { background: 'none', border: 'none', color: COLORS.muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '10px 16px' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  bookingRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: `1px solid ${COLORS.border}` },
  bookingCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 },
  timeChip: { fontSize: 13, fontWeight: 700, color: COLORS.rust, background: '#F3E2D5', padding: '4px 8px', borderRadius: 8, minWidth: 52, textAlign: 'center' },
  timeChipBig: { fontSize: 14, fontWeight: 800, color: COLORS.rustDark, background: '#F3E2D5', padding: '10px 12px', borderRadius: 10, minWidth: 64, textAlign: 'center', fontFamily: FONT.display },
  badge: { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20 },
  alertRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' },
  dateNav: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 },
  dateNavBtn: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.ink },
  dateNavLabel: { display: 'flex', alignItems: 'center', gap: 10 },
  dateInput: { border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14, background: '#fff', color: COLORS.ink },
  input: { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 12px', fontSize: 14, background: '#fff', color: COLORS.ink },
  textarea: { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 12px', fontSize: 14, background: '#fff', color: COLORS.ink, resize: 'vertical', lineHeight: 1.6 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fieldLabel: { display: 'block', fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 6 },
  modalActions: { display: 'flex', gap: 8, marginTop: 20 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,25,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${COLORS.border}` },
  closeBtn: { background: '#F3EFE6', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: COLORS.muted },
  modalBody: { padding: 20 },
  emptyState: { textAlign: 'center', padding: '28px 12px', color: COLORS.muted, fontSize: 14 },
  iconBtn: { background: '#F3EFE6', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: COLORS.inkSoft, flexShrink: 0 },
  iconBtnDanger: { color: '#C0392B', background: '#FBEAE7' },
  chipGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 },
  itemChip: { display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'right' },
  cartList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 },
  cartRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '8px 10px' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: '#F3EFE6', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: COLORS.ink },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderTop: `1px dashed ${COLORS.border}`, marginTop: 10 },
  saleHistRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: `1px solid ${COLORS.border}` },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '9px 12px', marginBottom: 14 },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: COLORS.ink },
  productRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 },
  barberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: `1px solid ${COLORS.border}` },
  expenseRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: `1px solid ${COLORS.border}` },
  tabPills: { display: 'flex', gap: 8, marginBottom: 18 },
  pill: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: COLORS.muted, cursor: 'pointer' },
  pillActive: { background: COLORS.rust, color: '#fff', borderColor: COLORS.rust },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 },
  templateCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '14px 10px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft },
  templateCardActive: { background: '#F3E2D5', borderColor: COLORS.rust, color: COLORS.rustDark },
  customerRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '9px 10px', cursor: 'pointer', width: '100%' },
  customerRowActive: { borderColor: COLORS.rust, background: '#FBF3EC' },
  avatarCircle: { width: 30, height: 30, borderRadius: '50%', background: '#F3EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.muted, flexShrink: 0 },
  linkBox: { display: 'flex', alignItems: 'center', gap: 10, background: '#F3EFE6', borderRadius: 10, padding: '10px 12px' },
  textBlock: { background: '#F3EFE6', borderRadius: 10, padding: 14, fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: COLORS.inkSoft },
  barberSettingRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: `1px solid ${COLORS.border}` },
  toggleBtn: { fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1px solid ${COLORS.border}`, background: '#F3EFE6', color: COLORS.muted, cursor: 'pointer' },
  toggleBtnActive: { background: '#EAF2EA', color: '#4A7A4A', borderColor: '#c9e0c9' },
};
