// lib/francetravail.js
// V5 : remplace Serper par l'API officielle France Travail Offres d'emploi v2
// https://francetravail.io

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const OFFRES_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const SCOPE = 'api_offresdemploiv2 o2dsoffre';

// Mots-clés de recherche pharma terrain France
// On peut utiliser motsCles OU codeROME (plus précis)
// D2401 = Relation commerciale en vente de véhicules (non)
// D1407 = Relation commerciale en services à domicile
// Les métiers terrain pharma sont surtout dans D1402 (Relation commerciale grands comptes) et D1407
// Plus simple : on part sur motsCles
const QUERIES = [
  { motsCles: 'visiteur médical' },
  { motsCles: 'délégué médical' },
  { motsCles: 'délégué pharmaceutique' },
  { motsCles: 'directeur régional pharmaceutique' },
  { motsCles: 'directeur régional laboratoire' },
  { motsCles: 'directeur de zone pharmaceutique' },
  { motsCles: 'directeur des ventes pharmaceutique' },
  { motsCles: 'key account manager pharmaceutique' },
  { motsCles: 'responsable régional pharmaceutique' },
  { motsCles: 'attaché scientifique' }
];

// 1. Obtenir un access token OAuth2 (valide 24h, on en refait un à chaque cron, simple)
async function getAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE
  });
  
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token FT : ${response.status} ${text.substring(0, 300)}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// 2. Rechercher des offres avec un token
async function searchOffres(token, params) {
  // On construit la query string
  // range = 0-149 pour récupérer les 150 premières offres (max par requête selon la doc)
  const qs = new URLSearchParams({
    ...params,
    range: '0-149'
  });
  
  const url = `${OFFRES_URL}?${qs.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  // 204 = pas de contenu (aucune offre), c'est un succès vide
  if (response.status === 204) return [];
  
  // 206 = partial content (normal avec range), c'est un succès
  if (!response.ok && response.status !== 206) {
    const text = await response.text();
    throw new Error(`Search FT : ${response.status} ${text.substring(0, 300)}`);
  }
  
  const data = await response.json();
  return data.resultats || [];
}

// Point d'entrée exporté
export async function fetchAllOffers({ clientId, clientSecret }) {
  const stats = { queries: 0, results: 0, errors: 0 };
  
  console.log(`[FT] Demande de token...`);
  const token = await getAccessToken(clientId, clientSecret);
  console.log(`[FT] Token obtenu (${token.substring(0, 15)}...)`);
  
  const allResults = [];
  
  for (const query of QUERIES) {
    stats.queries++;
    try {
      const offres = await searchOffres(token, query);
      console.log(`[FT] "${query.motsCles}" → ${offres.length} offres`);
      
      for (const offre of offres) {
        allResults.push({
          query: query.motsCles,
          // Champs France Travail directement structurés
          title: offre.intitule || '',
          company: offre.entreprise?.nom || '',
          description: offre.description || '',
          location_libelle: offre.lieuTravail?.libelle || '',
          departement: offre.lieuTravail?.codePostal?.substring(0, 2) || '',
          type_contrat: offre.typeContrat || '',
          date_creation: offre.dateCreation || null,
          date_actualisation: offre.dateActualisation || null,
          rome_code: offre.romeCode || '',
          rome_libelle: offre.romeLibelle || '',
          url: `https://candidat.francetravail.fr/offres/recherche/detail/${offre.id}`,
          raw_id: offre.id
        });
      }
      stats.results += offres.length;
      
      // Petit délai pour rester courtois avec l'API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`[FT] Erreur sur "${query.motsCles}":`, err.message);
      stats.errors++;
    }
  }
  
  console.log(`[FT] Total : ${stats.results} offres sur ${stats.queries} requêtes (${stats.errors} erreurs)`);
  if (allResults.length > 0) {
    console.log(`[FT] Exemple offre 0:`, JSON.stringify({
      title: allResults[0].title,
      company: allResults[0].company,
      location: allResults[0].location_libelle,
      url: allResults[0].url
    }));
  }
  
  return allResults;
}

