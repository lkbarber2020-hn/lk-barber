/**
 * Datos de conexión a Supabase (el proyecto de LK Barber, no el del salón).
 * Se copian de: Supabase > botón "Connect" o Project Settings > Data API / API Keys.
 *  - SUPABASE_URL:  "Project URL" (termina en .supabase.co)
 *  - SUPABASE_KEY:  la llave "anon public" o "publishable" (es pública por diseño;
 *                   la seguridad la ponen las reglas de la base de datos).
 * NUNCA pongas aquí la llave "service_role" / "secret".
 */
window.CONFIG = {
  SUPABASE_URL: 'https://retwmpwxqkibebolmfdn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_bWEBDjwfmuZKyZj-bMpzcA_7xW6ccpn',

  // Los usuarios entran con nombre de usuario + PIN. Por dentro Supabase
  // necesita un correo: se arma como usuario@DOMINIO. No se envían correos.
  DOMINIO_USUARIOS: 'lkbarber.app'
};
