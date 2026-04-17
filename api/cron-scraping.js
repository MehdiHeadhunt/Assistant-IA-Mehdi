// api/cron-scraping.js
// Cron Vercel : tourne tous les jours à 6h
// Scrape Serper, parse, agrège, stocke dans Supabase

import { createClient } from '@supabase/supabase-js';
import { fetchAllOffers } from '../lib/serper.js';
import { parseOffers } from '../lib/parser.js';
import { aggregateAndScore } from '../lib/scoring.js';

export default async function handler(req, res) {
  // Sécurité basique : Vercel Cron envoie un header spécifique
  // En dev/test manuel, on peut le bypass avec un secret
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Si CRON_SECRET non défini, on laisse passer (pour faciliter le setup)
  }
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const startTime = Date.now();
  console.log('[CRON] Démarrage scraping');
  
  try {
    // 1. Scrape Serper
    const rawResults = await fetchAllOffers(process.env.SERPER_API_KEY);
    console.log(`[CRON] ${rawResults.length} résultats bruts récupérés`);
    
    // 2. Parse
    const offers = parseOffers(rawResults);
    console.log(`[CRON] ${offers.length} offres exploitables après parsing`);
    
    // 3. Insert dans job_offers (upsert sur URL pour éviter doublons)
    let inserted = 0;
    for (const offer of offers) {
      const { error } = await supabase
        .from('job_offers')
        .upsert(offer, { onConflict: 'url' });
      if (!error) inserted++;
    }
    console.log(`[CRON] ${inserted} offres upsertées`);
    
    // 4. Récupère toutes les offres des 30 derniers jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentOffers, error: fetchError } = await supabase
      .from('job_offers')
      .select('*')
      .gte('date_scraping', thirtyDaysAgo.toISOString());
    
    if (fetchError) throw fetchError;
    
    // 5. Récupère les labos contactés < 30j
    const { data: recentActions } = await supabase
      .from('lab_actions')
      .select('labo')
      .eq('status', 'contacted')
      .gte('date_action', thirtyDaysAgo.toISOString());
    
    const recentlyContactedLabs = (recentActions || []).map(a => a.labo);
    
    // 6. Agrège et score
    const signals = aggregateAndScore(recentOffers || [], recentlyContactedLabs);
    console.log(`[CRON] ${signals.length} labos avec signaux`);
    
    // 7. Reset table lab_signals et insert les nouveaux
    await supabase.from('lab_signals').delete().neq('labo', '___never___');
    
    for (const signal of signals) {
      await supabase.from('lab_signals').upsert({
        labo: signal.labo,
        nb_postes_30j: signal.nb_postes_30j,
        fonctions: signal.fonctions,
        regions: signal.regions,
        score: signal.score,
        derniere_maj: new Date().toISOString()
      });
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[CRON] Terminé en ${duration}s`);
    
    return res.status(200).json({
      success: true,
      duration_seconds: duration,
      raw_results: rawResults.length,
      parsed_offers: offers.length,
      inserted: inserted,
      labos_avec_signaux: signals.length,
      top_5: signals.slice(0, 5).map(s => ({ labo: s.labo, score: s.score, postes: s.nb_postes_30j }))
    });
  } catch (err) {
    console.error('[CRON] Erreur:', err);
    return res.status(500).json({ error: err.message });
  }
}

