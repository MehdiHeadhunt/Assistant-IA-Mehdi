// api/triggers.js
// Endpoint lu par le dashboard frontend
// GET /api/triggers → liste des labos avec signaux + leurs offres

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS pour appel depuis le frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  try {
    // Récupère les signaux triés par score
    const { data: signals, error: signalsError } = await supabase
      .from('lab_signals')
      .select('*')
      .order('score', { ascending: false });
    
    if (signalsError) throw signalsError;
    
    // Récupère les actions sur les labos
    const { data: actions } = await supabase
      .from('lab_actions')
      .select('*');
    
    const actionsByLab = {};
    (actions || []).forEach(a => { actionsByLab[a.labo] = a; });
    
    // Récupère toutes les offres récentes (30j) pour pouvoir afficher le détail
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: offers } = await supabase
      .from('job_offers')
      .select('*')
      .gte('date_scraping', thirtyDaysAgo.toISOString())
      .order('date_scraping', { ascending: false });
    
    // Groupe les offres par labo
    const offersByLab = {};
    (offers || []).forEach(o => {
      if (!offersByLab[o.labo]) offersByLab[o.labo] = [];
      offersByLab[o.labo].push({
        titre: o.titre,
        fonction: o.fonction,
        region: o.region,
        source: o.source,
        url: o.url,
        date: o.date_scraping
      });
    });
    
    // Enrichit chaque signal avec ses offres et son action
    const enriched = (signals || []).map(s => ({
      ...s,
      offres: offersByLab[s.labo] || [],
      action: actionsByLab[s.labo] || null
    }));
    
    return res.status(200).json({
      success: true,
      total: enriched.length,
      derniere_maj: signals?.[0]?.derniere_maj || null,
      labos: enriched
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

