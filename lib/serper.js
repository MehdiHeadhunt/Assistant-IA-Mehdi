// lib/serper.js
// V4 : retour à /search avec requêtes qui ciblent les pages d'offres individuelles
// Stratégie : utiliser inurl: au lieu de site: pour taper dans les pages détail

const SERPER_URL = 'https://google.serper.dev/search';

// Chaque requête vise les URLs détaillées des jobboards (= pages d'offres individuelles, pas de listes)
// inurl: est moins agressif que site: et passe chez Serper
const QUERIES = [
  // Apec - les URLs de détail contiennent "/detail-offre"
  'visiteur médical inurl:detail-offre',
  'délégué médical inurl:detail-offre',
  'directeur régional pharma inurl:detail-offre',
  'directeur des ventes pharma inurl:detail-offre',
  // Indeed - les URLs de détail contiennent "viewjob" ou "jk="
  'visiteur médical pharma inurl:viewjob',
  'délégué pharmaceutique inurl:viewjob',
  'directeur régional laboratoire inurl:viewjob',
  // LinkedIn - URLs de détail contiennent "/jobs/view/"
  'visiteur médical inurl:jobs/view',
  'directeur régional pharma inurl:jobs/view',
  // Hellowork et autres - URLs détail contiennent "/emploi/"
  'visiteur médical pharma inurl:emploi',
  'directeur des ventes laboratoire inurl:emploi'
];

export async function fetchAllOffers(serperApiKey) {
  const allResults = [];
  const stats = { queries: 0, results: 0, errors: 0 };
  
  for (const query of QUERIES) {
    stats.queries++;
    try {
      const response = await fetch(SERPER_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          gl: 'fr',
          hl: 'fr',
          num: 30
        })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`[SERPER] Erreur ${response.status} pour "${query}": ${text.substring(0, 200)}`);
        stats.errors++;
        continue;
      }
      
      const data = await response.json();
      const organic = data.organic || [];
      console.log(`[SERPER] "${query}" → ${organic.length} résultats`);
      
      for (const result of organic) {
        allResults.push({
          query,
          title: result.title || '',
          link: result.link || '',
          snippet: result.snippet || '',
          date: result.date || null
        });
      }
      stats.results += organic.length;
      
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[SERPER] Exception sur "${query}":`, err.message);
      stats.errors++;
    }
  }
  
  console.log(`[SERPER] Total : ${stats.results} résultats sur ${stats.queries} requêtes (${stats.errors} erreurs)`);
  if (allResults.length > 0) {
    console.log(`[SERPER] Exemple résultat 0:`, JSON.stringify({
      title: allResults[0].title,
      link: allResults[0].link,
      snippet: (allResults[0].snippet || '').substring(0, 200)
    }));
  }
  return allResults;
}
