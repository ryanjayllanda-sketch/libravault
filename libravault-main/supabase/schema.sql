-- ============================================================
-- LIBRAVAULT — FULL DATABASE SCHEMA (v1, ACID + indexed + safe)
-- Run in Supabase → SQL Editor → New Query
-- Safe to re-run (drops first, then rebuilds)
-- ============================================================

-- ── Drop existing policies ──────────────────────────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS on_order_item_insert ON public.order_items;
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS set_review_verified_on_insert ON public.reviews;
DROP TRIGGER IF EXISTS on_address_default_change ON public.addresses;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_stock() CASCADE;
DROP FUNCTION IF EXISTS public.restore_stock_on_cancel() CASCADE;
DROP FUNCTION IF EXISTS public.set_review_verified() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_single_default_address() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_staff() CASCADE;
DROP FUNCTION IF EXISTS public.place_order(JSONB, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_profile_exists() CASCADE;
DROP FUNCTION IF EXISTS public.sync_product_sizes(BIGINT, JSONB) CASCADE;

DROP TABLE IF EXISTS public.wishlists CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.product_editions CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- ── profiles: stores user info & role (linked 1:1 to auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('super_admin','manager','editor','viewer','customer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_role  ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ── products: book catalog
-- sizes: 1=Paperback, 2=Hardcover, 3=eBook, 4=Audiobook (array of available editions)
-- colors: cover accent hex colors for UI display
CREATE TABLE public.products (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sale_price    NUMERIC(10,2) CHECK (sale_price >= 0),
  category      TEXT NOT NULL CHECK (category IN ('fiction','non-fiction','science','history')),
  image         TEXT NOT NULL DEFAULT '',
  colors        TEXT[]    NOT NULL DEFAULT '{}',   -- cover palette
  sizes         NUMERIC[] NOT NULL DEFAULT '{}',   -- available editions: 1=Paperback,2=Hardcover,3=eBook,4=Audiobook
  badge         TEXT CHECK (badge IN ('new','sale') OR badge IS NULL),
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active   ON public.products(is_active);
CREATE INDEX idx_products_badge    ON public.products(badge);

-- ── product_editions: per-edition stock (editions: 1=Paperback, 2=Hardcover, 3=eBook, 4=Audiobook)
CREATE TABLE public.product_editions (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  edition     NUMERIC NOT NULL,  -- 1=Paperback, 2=Hardcover, 3=eBook, 4=Audiobook
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, edition)
);
CREATE INDEX idx_product_editions_product_id ON public.product_editions(product_id);

-- ── addresses: saved delivery addresses (one default per user)
CREATE TABLE public.addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  province    TEXT NOT NULL,
  zip         TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'Philippines',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);
CREATE UNIQUE INDEX idx_addresses_one_default_per_user
  ON public.addresses(user_id) WHERE is_default = TRUE;

-- ── orders: header table for transactions
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  address_id      UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'Processing'
                    CHECK (status IN ('Processing','Shipped','Delivered','Cancelled')),
  payment_method  TEXT NOT NULL DEFAULT 'cod'
                    CHECK (payment_method IN ('card','gcash','cod')),
  subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total           NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id    ON public.orders(user_id);
CREATE INDEX idx_orders_status     ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- ── order_items: line items (edition = 1=Paperback, 2=Hardcover, 3=eBook, 4=Audiobook)
CREATE TABLE public.order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  edition     NUMERIC NOT NULL,  -- 1=Paperback, 2=Hardcover, 3=eBook, 4=Audiobook
  qty         INTEGER NOT NULL CHECK (qty > 0),
  unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id   ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- ── reviews: one per (user, product)
CREATE TABLE public.reviews (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX idx_reviews_user_id    ON public.reviews(user_id);

-- ── wishlists (reading list)
CREATE TABLE public.wishlists (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlists_user_id ON public.wishlists(user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('super_admin','manager','editor','viewer');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"       ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"     ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Staff can read all profiles"      ON public.profiles FOR SELECT USING (is_staff());
CREATE POLICY "Super admin can update roles"     ON public.profiles FOR UPDATE USING (get_user_role() = 'super_admin');

CREATE POLICY "Anyone can read active products"  ON public.products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Staff can read all products"      ON public.products FOR SELECT USING (is_staff());
CREATE POLICY "Editor+ can insert products"      ON public.products FOR INSERT WITH CHECK (get_user_role() IN ('super_admin','manager','editor'));
CREATE POLICY "Editor+ can update products"      ON public.products FOR UPDATE USING (get_user_role() IN ('super_admin','manager','editor'));
CREATE POLICY "Manager+ can delete products"     ON public.products FOR DELETE USING (get_user_role() IN ('super_admin','manager'));

CREATE POLICY "Anyone can read product editions" ON public.product_editions FOR SELECT USING (TRUE);
CREATE POLICY "Editor+ can manage editions"      ON public.product_editions FOR ALL USING (get_user_role() IN ('super_admin','manager','editor'));

CREATE POLICY "Users manage own addresses"       ON public.addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Staff can read addresses"         ON public.addresses FOR SELECT USING (is_staff());

CREATE POLICY "Users can read own orders"        ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders"          ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can read all orders"        ON public.orders FOR SELECT USING (is_staff());
CREATE POLICY "Manager+ can update order status" ON public.orders FOR UPDATE USING (get_user_role() IN ('super_admin','manager'));

CREATE POLICY "Users can read own order items"   ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Users can insert order items"     ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Staff can read all order items"   ON public.order_items FOR SELECT USING (is_staff());

CREATE POLICY "Anyone can read reviews"          ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Auth users can add reviews"       ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews"     ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews"     ON public.reviews FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Manager+ can delete any review"   ON public.reviews FOR DELETE USING (get_user_role() IN ('super_admin','manager'));

CREATE POLICY "Users manage own reading list"    ON public.wishlists FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''), 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name',''), 'customer'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_orders_updated_at   BEFORE UPDATE ON public.orders   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock decrement on order item insert (atomic with FOR UPDATE lock)
CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS TRIGGER AS $$
DECLARE current_stock INTEGER;
BEGIN
  SELECT stock INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock < NEW.qty THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id USING ERRCODE = '23514';
  END IF;
  UPDATE public.products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
  -- Also decrement per-edition stock if tracked
  UPDATE public.product_editions
    SET stock = GREATEST(0, stock - NEW.qty)
  WHERE product_id = NEW.product_id AND edition = NEW.edition;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_item_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock();

CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Cancelled' AND OLD.status != 'Cancelled' THEN
    UPDATE public.products p SET stock = p.stock + oi.qty
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    -- Restore per-edition stock
    UPDATE public.product_editions pe SET stock = pe.stock + oi.qty
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = pe.product_id AND oi.edition = pe.edition;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_cancel();

CREATE OR REPLACE FUNCTION public.set_review_verified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.verified := EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = NEW.user_id AND oi.product_id = NEW.product_id AND o.status != 'Cancelled'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_review_verified_on_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_review_verified();

CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.addresses SET is_default = FALSE WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_address_default_change
  AFTER INSERT OR UPDATE OF is_default ON public.addresses
  FOR EACH ROW WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.ensure_single_default_address();

-- ============================================================
-- ATOMIC ORDER PLACEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_order(
  p_address_id     UUID,
  p_payment_method TEXT,
  p_items          JSONB,   -- [{product_id, edition, qty, unit_price}, ...]
  p_subtotal       NUMERIC,
  p_shipping       NUMERIC,
  p_tax            NUMERIC,
  p_total          NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_order_id  UUID;
  v_item      JSONB;
  v_uid       UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.orders (user_id, address_id, payment_method, subtotal, shipping, tax, total)
  VALUES (v_uid, p_address_id, p_payment_method, p_subtotal, p_shipping, p_tax, p_total)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, edition, qty, unit_price)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::BIGINT,
      (v_item->>'edition')::NUMERIC,
      (v_item->>'qty')::INTEGER,
      (v_item->>'unit_price')::NUMERIC
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Sync editions & stock (used by admin product form)
CREATE OR REPLACE FUNCTION public.sync_product_sizes(
  p_product_id   BIGINT,
  p_size_stocks  JSONB   -- [{size: 1, stock: 10}, ...]  (size = edition number)
) RETURNS VOID AS $$
DECLARE
  v_item   JSONB;
  v_total  INTEGER := 0;
BEGIN
  DELETE FROM public.product_editions WHERE product_id = p_product_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_size_stocks) LOOP
    INSERT INTO public.product_editions (product_id, edition, stock)
    VALUES (p_product_id, (v_item->>'size')::NUMERIC, (v_item->>'stock')::INTEGER);
    v_total := v_total + (v_item->>'stock')::INTEGER;
  END LOOP;
  UPDATE public.products SET
    sizes = ARRAY(SELECT (e->>'size')::NUMERIC FROM jsonb_array_elements(p_size_stocks) e),
    stock = v_total
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;

-- ============================================================
-- SEED DATA (prices in PHP)
-- ============================================================

INSERT INTO public.products (name, description, price, sale_price, category, image, colors, sizes, badge, stock) VALUES
('The Midnight Library',       'A dazzling novel about all the lives you could have lived. Between life and death there is a library, and within that library, the shelves go on forever.',            650.00, NULL,   'fiction',     'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80', ARRAY['#1a1a2e','#16213e','#0f3460'], ARRAY[1,2,3],   'new',  24),
('Sapiens',                    'A Brief History of Humankind. From a renowned historian comes a groundbreaking narrative of humanity''s creation and evolution.',                                       890.00, NULL,   'history',     'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80', ARRAY['#f5a623','#d4891a','#111'],   ARRAY[1,2,3,4], NULL,   40),
('A Brief History of Time',    'Stephen Hawking''s landmark volume on the structure, origin, development, and eventual fate of the Universe.',                                                         750.00, 550.00, 'science',     'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&q=80', ARRAY['#2563eb','#111','#f04048'],  ARRAY[1,2,3],   'sale', 12),
('Atomic Habits',              'An easy and proven way to build good habits and break bad ones. Tiny changes, remarkable results.',                                                                     720.00, NULL,   'non-fiction', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80', ARRAY['#111','#3b82f6','#f04048'],  ARRAY[1,2,3,4], NULL,   30),
('Dune',                       'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides — heir to a noble family tasked with ruling the universe''s most dangerous planet.',     980.00, NULL,   'fiction',     'https://images.unsplash.com/photo-1495640452828-3df6795cf69b?w=600&q=80', ARRAY['#dc2626','#111','#fff'],     ARRAY[1,2,3,4], 'new',  8),
('Guns, Germs, and Steel',     'A Pulitzer Prize-winning analysis of why Western civilizations came to dominate the rest of the world.',                                                                820.00, 650.00, 'history',     'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600&q=80', ARRAY['#fff','#f5e6d3','#111'],     ARRAY[1,2,3],   'sale', 20),
('The Selfish Gene',           'Richard Dawkins'' classic exposition of evolutionary theory, told from the gene''s eye view of life, is both riveting and controversial.',                             690.00, NULL,   'science',     'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&q=80', ARRAY['#e5ff00','#111'],            ARRAY[1,2,3],   'new',  5),
('Thinking, Fast and Slow',    'Daniel Kahneman reveals the two systems that drive the way we think and how to make better decisions by understanding them.',                                           760.00, NULL,   'non-fiction', 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&q=80', ARRAY['#22c55e','#fff','#111'],     ARRAY[1,2,3,4], NULL,   16);

-- Seed per-edition stock for each book
DO $$
DECLARE v_pid BIGINT;
BEGIN
  FOR v_pid IN SELECT id FROM public.products LOOP
    INSERT INTO public.product_editions (product_id, edition, stock)
    SELECT v_pid, unnest(sizes::INTEGER[]), (stock / array_length(sizes,1))
    FROM public.products WHERE id = v_pid
    ON CONFLICT (product_id, edition) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- AFTER REGISTERING, MAKE YOURSELF SUPER ADMIN:
-- UPDATE public.profiles SET role = 'super_admin' WHERE email = 'your@email.com';
-- ============================================================
