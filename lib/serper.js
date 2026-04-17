// lib/serper.js
// V2 : requêtes simplifiées + logs détaillés

const SERPER_URL = 'https://google.serper.dev/search';

// Requêtes simplifiées : on cible les jobboards via gl=fr plutôt qu'avec site:
// On enlève les guillemets doubles complexes qui font planter Serper
const QUERIES = [
  // Visiteurs médicaux
  'visiteur médical pharma emploi',
  'délégué médical pharma recrutement',
  'délégué pharmaceutique emploi',
  // Directeurs régionaux
  'directeur régional pharma emploi',
  'directeur régional laboratoire recrutement',
  // Directeurs de zone
  'directeur de zone pharma emploi',
  // Directeurs des ventes
  'directeur des ventes pharma emploi',
  'directeur commercial laboratoire pharmaceutique',
  // KAM / hospitalier
  'key account manager pharma emploi',
  'responsable régional pharma laboratoire',
  // Sites spécifiques pour compléter
  'pharma visiteur médical site:apec.fr',
  'laboratoire directeur régional site:apec.fr'
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
        console.error(`[SERPER] Erreur ${response.status} pour "${query}": ${text.substring(0, 100)}`);
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
  return allResults;
}
