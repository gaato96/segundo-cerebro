import { Sidebar } from '@/components/layout/Sidebar'
import { BottomBar } from '@/components/layout/BottomBar'
import { QuickCaptureButton } from '@/components/shared/QuickCaptureButton'
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { QuickExpenseButton } from '@/components/finances/QuickExpenseButton'
import { FloatingActions } from '@/components/shared/FloatingActions'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto pb-[80px] md:pb-0">
                {children}
            </main>

            <CommandPalette />
            <QuickCaptureButton />
            <AssistantLauncher />
            <QuickExpenseButton />
            {/* Un solo botón flotante que abre los tres de arriba (y los que se sumen) */}
            <FloatingActions />

            {/* Mobile Bottom Bar */}
            <BottomBar />
        </div>
    )
}
