import { Sidebar } from '@/components/layout/Sidebar'
import { BottomBar } from '@/components/layout/BottomBar'
import { QuickCaptureButton } from '@/components/shared/QuickCaptureButton'

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
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
                {children}
            </main>

            <QuickCaptureButton />

            {/* Mobile Bottom Bar */}
            <BottomBar />
        </div>
    )
}
