-- =========================================================
-- سيستم الصالون: إعداد قاعدة بيانات Supabase
-- شغّل الكود ده كامل في Supabase Dashboard -> SQL Editor -> New query -> Run
-- =========================================================

-- 1) جدول بيانات الصالون (بلوك واحد يحتوي كل حاجة: الحلاقين، الخدمات،
--    المنتجات، العملاء، الحجزات، المبيعات، المصاريف) زي ما كان الكود الأصلي شغال
--    محليًا، لكن هنا بيتخزن على Supabase عشان يبقى متاح من أي جهاز ولأي موظف.
create table if not exists public.shop_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_data enable row level security;

-- أي موظف عامل تسجيل دخول (authenticated) يقدر يقرأ ويعدل بيانات الصالون
drop policy if exists "staff can read shop data" on public.shop_data;
create policy "staff can read shop data"
  on public.shop_data for select
  to authenticated
  using (true);

drop policy if exists "staff can insert shop data" on public.shop_data;
create policy "staff can insert shop data"
  on public.shop_data for insert
  to authenticated
  with check (true);

drop policy if exists "staff can update shop data" on public.shop_data;
create policy "staff can update shop data"
  on public.shop_data for update
  to authenticated
  using (true)
  with check (true);

-- 2) جدول ربط "رقم التليفون" بالإيميل المسجل في Supabase Auth، عشان
--    صاحب المحل يسجل دخول برقم تليفونه بدل ما يحفظ إيميل.
create table if not exists public.staff (
  username text primary key, -- هنا بيتخزن رقم التليفون (أرقام بس، من غير رموز)
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- لازم يبقى ممكن نقرأ الإيميل المرتبط برقم التليفون *قبل* تسجيل الدخول،
-- عشان كده السماح للزوار (anon) بالقراءة فقط، مفيش صلاحية تعديل أو حذف لحد
-- إلا من الداشبورد.
drop policy if exists "anyone can look up phone to email" on public.staff;
create policy "anyone can look up phone to email"
  on public.staff for select
  to anon, authenticated
  using (true);

-- 3) جدول "الدور" (الطابور): العملاء يكتبوا اسمهم ورقمهم ويحجزوا مكانهم
--    بالدور من غير ما يحتاجوا يعملوا حساب أو باسورد. صاحب المحل بس هو
--    اللي يدير الدور (ينده، يخلص، يلغي) من تبويب "الدور" في لوحة التحكم.
create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  status text not null default 'waiting', -- waiting | in_progress | done | cancelled
  created_at timestamptz not null default now()
);

alter table public.queue_entries enable row level security;

-- أي حد (حتى من غير تسجيل دخول) يقدر يضيف نفسه للدور
drop policy if exists "anyone can join the queue" on public.queue_entries;
create policy "anyone can join the queue"
  on public.queue_entries for insert
  to anon, authenticated
  with check (status = 'waiting');

-- أي حد يقدر يشوف الدور (زي لوحة معلقة في المحل، الكل شايف الترتيب)
drop policy if exists "anyone can view the queue" on public.queue_entries;
create policy "anyone can view the queue"
  on public.queue_entries for select
  to anon, authenticated
  using (true);

-- بس صاحب المحل (authenticated) اللي يقدر يعدل حالة الدور أو يمسح حد منه
drop policy if exists "staff can update queue" on public.queue_entries;
create policy "staff can update queue"
  on public.queue_entries for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "staff can delete queue" on public.queue_entries;
create policy "staff can delete queue"
  on public.queue_entries for delete
  to authenticated
  using (true);

-- =========================================================
-- 4) تفعيل الـ Realtime على الجداول عشان أي تحديث يظهر فورًا
--    من غير ما حد يعمل Refresh (سواء صاحب المحل أو العميل في صفحة الدور).
--    الكود ده آمن يتنفذ أكتر من مرة (مش هيدي خطأ لو الجدول مضاف بالفعل).
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_data'
  ) then
    alter publication supabase_realtime add table public.shop_data;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_entries'
  ) then
    alter publication supabase_realtime add table public.queue_entries;
  end if;
end $$;

-- =========================================================
-- ملاحظة: إنشاء حساب صاحب المحل نفسه بيتم من
-- Supabase Dashboard -> Authentication -> Users -> Add user
-- (بإيميل وباسورد)، وبعدين تضيف صف في جدول staff بربط
-- رقم التليفون (أرقام بس) باليوزر ده. مثال:
--
-- insert into public.staff (username, email, full_name)
-- values ('01000000001', 'owner@salon.local', 'صاحب المحل');
-- =========================================================
