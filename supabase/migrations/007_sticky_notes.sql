CREATE TABLE IF NOT EXISTS sticky_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT 'bg-yellow-200 text-yellow-900',
    position_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sticky notes" ON sticky_notes
    FOR ALL USING (auth.uid() = user_id);
