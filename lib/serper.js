// lib/serper.js
// V3 : utilise l'endpoint /jobs de Serper pour des offres individuelles structurées

const SERPER_JOBS_URL = 'https://google.serper.dev/jobs';

// Requêtes courtes et ciblées pour Google Jobs
const QUERIES = [
  'visiteur médical',
  'délégué médical',
  'délégué pharmaceutique',
  'directeur régional pharma',
  'directeur régional laboratoire',
  'directeur de zone pharma',
  'directeur des ventes pharma',
  'directeur commercial laboratoire',
  'key account manager pharma',
  'responsable régional pharma'
];

export async function fetchAllOffers(serperApiKey) {
  const allResults = [];
  const stats = { queries: 0, results: 0, errors: 0 };
  
  for (const query of QUERIES) {
    stats.queries++;
    try {
      const response = await fetch(SERPER_JOBS_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          gl: 'fr',
          hl: 'fr',
          location: 'France'
        })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`[SERPER] Erreur ${response.status} pour "${query}": ${text.substring(0, 200)}`);
        stats.errors++;
        continue;
      }
      
      const data = await response.json();
      // L'endpoint /jobs renvoie dans "jobs" au lieu de "organic"
      const jobs = data.jobs || [];
      console.log(`[SERPER] "${query}" → ${jobs.length} offres`);
      
      for (const job of jobs) {
        allResults.push({
          query,
          title: job.title || '',
          company: job.company || '',
          location: job.location || '',
          description: job.description || '',
          link: job.link || job.apply_link || '',
          source: job.source || '',
          via: job.via || '',
          date: job.date_posted || null
        });
      }
      stats.results += jobs.length;
      
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[SERPER] Exception sur "${query}":`, err.message);
      stats.errors++;
    }
  }
  
  console.log(`[SERPER] Total : ${stats.results} offres sur ${stats.queries} requêtes (${stats.errors} erreurs)`);
  
  // Log un exemple pour debug
  if (allResults.length > 0) {
    console.log(`[SERPER] Exemple offre 0:`, JSON.stringify(allResults[0]));
  }
  
  return allResults;
}
