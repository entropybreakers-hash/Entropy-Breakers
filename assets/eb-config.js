/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — Supabase configuration
   ───────────────────────────────────────────────────────────────
   Töltsd ki a két értéket a Supabase projektedből:
     Dashboard → Project Settings → API
       • Project URL  → url
       • anon public  → anonKey
   Az anon kulcs nyugodtan szerepelhet kliensoldali kódban — az
   adatokat a Row Level Security (lásd supabase-schema.sql) védi.

   Amíg a placeholder értékek itt maradnak, a szinkron réteg inaktív,
   és a platform a megszokott módon, localStorage-ból működik tovább.
   ═══════════════════════════════════════════════════════════════ */
window.EB_SUPABASE = {
  url:     'https://dgpkeqceeumhkrcidhph.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncGtlcWNlZXVtaGtyY2lkaHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzczODcsImV4cCI6MjA5NDI1MzM4N30.u0bO1cDKDKyhnVUHw5U_jNdQdpaoiTQ-7gMmqZuEmHM'
};
