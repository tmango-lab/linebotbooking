-- Create fields table for foreign key reference
CREATE TABLE IF NOT EXISTS public.fields (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    size TEXT,
    price_pre INTEGER NOT NULL,
    price_post INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 6 courts
INSERT INTO public.fields (id, name, size, price_pre, price_post) VALUES
    (2424, 'สนาม 1', '5 คน', 500, 700),
    (2425, 'สนาม 2', '5 คน', 500, 700),
    (2428, 'สนาม 3', '7-8 คน', 1000, 1200),
    (2426, 'สนาม 4', '7 คน', 800, 1000),
    (2427, 'สนาม 5', '7 คน', 800, 1000),
    (2429, 'สนาม 6', '7 คน (ใหม่)', 1000, 1200)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable read for all users" ON public.fields FOR SELECT USING (true);
