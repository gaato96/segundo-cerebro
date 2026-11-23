import { getPushStatus } from '@/lib/actions/notifications'
import { NotificationSettings } from '@/components/notifications/NotificationSettings'
import { DayCutoffSettings } from '@/components/settings/DayCutoffSettings'
import { ThemeSettings } from '@/components/settings/ThemeSettings'
import { getAppDay } from '@/lib/actions/day'
import { MinimalModeToggle } from '@/components/dashboard/MinimalModeToggle'
import { getMinimalMode } from '@/lib/actions/profile'
import { PageShell, PageHeader } from '@/components/ui/kit'

export const dynamic = 'force-dynamic'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="py-8 border-b border-hairline last:border-0 first:pt-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {hint && <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-[60ch]">{hint}</p>}
            <div className={hint ? '' : 'mt-4'}>{children}</div>
        </section>
    )
}

export default async function AjustesPage() {
    const [status, appDay, minimal] = await Promise.all([
        getPushStatus().catch(() => ({
            prefs: null,
            devices: [] as any[],
            vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
            configured: false
        })),
        getAppDay(),
        getMinimalMode()
    ])

    return (
        <PageShell className="max-w-[760px]">
            <PageHeader label="Sistema" title="Ajustes" subtitle="Cómo se ve, cuándo termina tu día y qué te avisa." />

            <Section title="Tema" hint="Se guarda en este dispositivo: el celu puede ir claro y la compu oscura.">
                <ThemeSettings />
            </Section>

            <Section title="Corte del día" hint="Pasada la medianoche, el día sigue siendo el que estás terminando hasta esta hora.">
                <DayCutoffSettings
                    cutoffHour={appDay.cutoffHour}
                    appDate={appDay.date}
                    calendarDate={appDay.calendarDate}
                    isAfterMidnight={appDay.isAfterMidnight}
                />
            </Section>

            <Section title="Cuánto registrar">
                <MinimalModeToggle enabled={minimal} variant="card" />
            </Section>

            <Section title="Notificaciones" hint="Briefing de la mañana, cierre del día, revisión semanal y recordatorios en la PC.">
                <NotificationSettings
                    prefs={status.prefs}
                    devices={status.devices}
                    vapidPublicKey={status.vapidPublicKey}
                    configured={status.configured}
                />
            </Section>

            <Section title="Compartir al Segundo Cerebro" hint="Con la app instalada en el celular (Agregar a pantalla de inicio), aparece en el menú Compartir de cualquier app: un link, un texto o una idea caen directo al Inbox.">
                <p className="text-xs text-muted-foreground">Si ya la tenías instalada, desinstalala y volvé a instalarla para que el celular la registre como destino.</p>
            </Section>
        </PageShell>
    )
}
