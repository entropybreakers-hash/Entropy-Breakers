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
  url:     'YOUR_SUPABASE_PROJECT_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
