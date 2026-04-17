// lib/scoring.js
// Agrège les offres par labo sur 30 jours et calcule un score

export function aggregateAndScore(offers, recentlyContactedLabs = []) {
  // Groupement par labo
  const byLab = new Map();
  
  for (const offer of offers) {
    if (!byLab.has(offer.labo)) {
      byLab.set(offer.labo, {
        labo: offer.labo,
        offers: [],
        fonctions: {},
        regions: new Set()
      });
    }
    const entry = byLab.get(offer.labo);
    entry.offers.push(offer);
    entry.fonctions[offer.fonction] = (entry.fonctions[offer.fonction] || 0) + 1;
    if (offer.region) entry.regions.add(offer.region);
  }
  
  // Calcul du score pour chaque labo
  const signals = [];
  for (const [labo, data] of byLab.entries()) {
    const nbPostes = data.offers.length;
    const nbRegions = data.regions.size;
    const nbFonctions = Object.keys(data.fonctions).length;
    const hasManagement = !!(data.fonctions.DR || data.fonctions.DZ || data.fonctions.DSV);
    
    let score = 0;
    score += nbPostes * 10;
    score += nbRegions * 15;
    score += nbFonctions * 5;
    if (hasManagement) score += 20;
    
    // Pénalité si déjà contacté < 30j
    if (recentlyContactedLabs.includes(labo)) {
      score -= 50;
    }
    
    signals.push({
      labo,
      nb_postes_30j: nbPostes,
      fonctions: data.fonctions,
      regions: Array.from(data.regions),
      score: Math.max(0, score)
    });
  }
  
  // Tri par score décroissant
  signals.sort((a, b) => b.score - a.score);
  
  return signals;
}

