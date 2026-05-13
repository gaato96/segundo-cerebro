const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    'https://wekkywlshtufqsqeyiba.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indla2t5d2xzaHR1ZnFzcWV5aWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODg3NzksImV4cCI6MjA5MDA2NDc3OX0.MJKLE9zFWuu6NoiGQ7y-EDpRUpDvkWIjagor-azs-ws'
)

async function run() {
    // Test if columns already exist by trying a select
    const { data, error } = await supabase
        .from('tasks')
        .select('reminder_time, reminder_fired')
        .limit(1)

    if (error) {
        console.log('Columns do not exist yet. Error:', error.message)
        console.log('')
        console.log('=== MANUAL MIGRATION REQUIRED ===')
        console.log('Please run this SQL in your Supabase SQL Editor:')
        console.log('')
        console.log('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT NULL;')
        console.log('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_fired BOOL DEFAULT FALSE;')
        console.log('')
        console.log('CREATE INDEX IF NOT EXISTS tasks_reminder_lookup ON tasks(user_id, due_date, reminder_time) WHERE reminder_time IS NOT NULL AND reminder_fired = FALSE AND status != \'Done\';')
    } else {
        console.log('✅ Columns already exist! Migration not needed.')
        console.log('Sample data:', JSON.stringify(data))
    }
}

run()
