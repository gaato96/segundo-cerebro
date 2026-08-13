const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    'https://wekkywlshtufqsqeyiba.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indla2t5d2xzaHR1ZnFzcWV5aWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODg3NzksImV4cCI6MjA5MDA2NDc3OX0.MJKLE9zFWuu6NoiGQ7y-EDpRUpDvkWIjagor-azs-ws'
)

async function test() {
    console.log('Testing task status update...')
    // Try to update a nonexistent task ID to check constraint error if any
    const { error } = await supabase
        .from('tasks')
        .update({ status: 'Missed' })
        .eq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
        console.log('Error updating status to Missed:', error.message)
    } else {
        console.log('✅ Status Missed allowed or no constraint error on empty match!')
    }
}

test()
