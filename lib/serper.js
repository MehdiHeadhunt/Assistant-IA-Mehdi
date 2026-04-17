// lib/serper.js
// Wrapper autour de l'API Serper pour scraper les offres pharma terrain

const SERPER_URL = 'https://google.serper.dev/search';

// Requêtes ciblées pharma terrain France
// On vise jobboards principaux et on filtre par fonction
const QUERIES = [
  // Visiteurs médicaux
  '"visiteur médical" pharma site:apec.fr',
  '"visiteur médical" laboratoire site:fr.indeed.com',
  '"délégué médical" pharma site:apec.fr',
  '"délégué pharmaceutique" site:apec.fr',
  // Directeurs régionaux
  '"directeur régional" pharma OR laboratoire site:apec.fr',
  '"directeur régional ventes" pharma site:fr.indeed.com',
  // Directeurs de zone
  '"directeur de zone" pharma OR laboratoire site:apec.fr',
  '"directeur de zone" pharmaceutique site:fr.indeed.com',
  // Directeurs des ventes
  '"directeur des ventes" pharma site:apec.fr',
  '"directeur commercial" laboratoire site:apec.fr',
  // KAM / hospitalier
  '"key account manager" pharma site:apec.fr',
  '"responsable régional" pharma site:apec.fr'
];

export async function fetchAllOffers(serperApiKey) {
  const allResults = [];
  
  for (const query of QUERIES) {
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
        console.error(`Serper error for query "${query}": ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const organic = data.organic || [];
      
      for (const result of organic) {
        allResults.push({
          query,
          title: result.title || '',
          link: result.link || '',
          snippet: result.snippet || '',
          date: result.date || null
        });
      }
      
      // Petit délai pour ne pas se faire rate-limit
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`Error on query "${query}":`, err.message);
    }
  }
  
  return allResults;
}

