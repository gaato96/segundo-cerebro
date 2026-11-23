import { Sidebar } from '@/components/layout/Sidebar'
import { BottomBar } from '@/components/layout/BottomBar'
import { TopBar, MobileHeader } from '@/components/layout/TopBar'
import { QuickCaptureButton } from '@/components/shared/QuickCaptureButton'
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { QuickExpenseButton } from '@/components/finances/QuickExpenseButton'
import { PcReminders } from '@/components/notifications/PcReminders'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-[100dvh] overflow-hidden">
            <Sidebar />

            <main className="flex-1 min-w-0 overflow-y-auto pb-[88px] md:pb-0">
                <TopBar />
                <MobileHeader />
                {children}
            </main>

            <CommandPalette />
            <PcReminders />
            <QuickCaptureButton />
            <AssistantLauncher />
            <QuickExpenseButton />

            <BottomBar />
        </div>
    )
}
