-- ===============================================
-- MIGRACION 027 (OPCIONAL): CRON DE AVISOS CADA 5 MINUTOS
--
-- Vercel en el plan gratis solo deja correr el cron una vez por día, así que
-- los avisos con hora (compromiso, tareas, hábitos) no llegaban a horario.
-- Esto hace que Supabase llame al endpoint cada 5 minutos.
--
-- ANTES DE PEGARLO reemplazá:
--   TU-DOMINIO   -> el dominio de la app en Vercel (ej. segundo-cerebro.vercel.app)
--   TU_SECRETO   -> el valor de CRON_SECRET de las variables de entorno de Vercel
--                   (si no existe, creala con cualquier texto largo y redeployá)
-- ===============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Si ya existía, se reemplaza
SELECT cron.unschedule('segundo-cerebro-avisos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'segundo-cerebro-avisos');

SELECT cron.schedule(
    'segundo-cerebro-avisos',
    '*/5 * * * *',
    $$
    SELECT net.http_get(
        url := 'https://TU-DOMINIO/api/notifications/cron?window=5',
        headers := jsonb_build_object('Authorization', 'Bearer TU_SECRETO'),
        timeout_milliseconds := 30000
    );
    $$
);

-- Para ver si está corriendo:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Para apagarlo:
--   SELECT cron.unschedule('segundo-cerebro-avisos');
