// lib/parser.js
// V3 : adapté aux résultats de Serper /jobs
// Le labo est directement dans le champ "company" des résultats

const REGIONS_KEYWORDS = {
  'IDF': ['ile-de-france', 'île-de-france', 'paris', 'idf', 'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', 'val-d\'oise', 'seine-et-marne', 'yvelines', 'essonne', 'nanterre', 'boulogne', 'neuilly', 'levallois', 'issy', 'saint-denis', 'creteil', 'créteil', 'versailles'],
  'Nord': ['lille', 'nord', 'hauts-de-france', 'amiens', 'arras', 'dunkerque', 'valenciennes', 'roubaix', 'tourcoing'],
  'Est': ['strasbourg', 'metz', 'nancy', 'reims', 'mulhouse', 'grand est', 'alsace', 'lorraine', 'champagne', 'colmar', 'épinal', 'epinal'],
  'Ouest': ['nantes', 'rennes', 'brest', 'angers', 'le mans', 'bretagne', 'pays de la loire', 'saint-nazaire', 'vannes', 'quimper', 'lorient'],
  'Sud-Ouest': ['bordeaux', 'toulouse', 'pau', 'bayonne', 'limoges', 'nouvelle-aquitaine', 'occitanie', 'montpellier', 'perpignan', 'nimes', 'nîmes', 'biarritz'],
  'Sud-Est': ['lyon', 'grenoble', 'saint-etienne', 'saint-étienne', 'auvergne-rhône-alpes', 'rhône-alpes', 'aura', 'annecy', 'chambéry', 'clermont', 'valence'],
  'PACA': ['marseille', 'nice', 'aix-en-provence', 'toulon', 'avignon', 'paca', 'provence', 'côte d\'azur', 'cannes', 'antibes', 'monaco'],
  'Centre': ['orléans', 'tours', 'bourges', 'centre-val de loire', 'chartres', 'blois'],
  'Normandie': ['rouen', 'caen', 'le havre', 'normandie', 'évreux', 'evreux'],
  'Bourgogne': ['dijon', 'besançon', 'bourgogne', 'franche-comté', 'mâcon', 'macon'],
};

function detectFonction(text) {
  const t = (text || '').toLowerCase();
  if (/directeur\s+(des\s+)?ventes|directeur\s+commercial/.test(t)) return 'DSV';
  if (/directeur\s+de\s+zone/.test(t)) return 'DZ';
  if (/directeur\s+régional|directeur\s+regional/.test(t)) return 'DR';
  if (/key\s+account|\bkam\b/.test(t)) return 'KAM';
  if (/responsable\s+régional|responsable\s+regional/.test(t)) return 'RR';
  if (/visiteur\s+médical|visiteur\s+medical|délégué\s+médical|delegue\s+medical|délégué\s+pharmaceutique|delegue\s+pharmaceutique/.test(t)) return 'VM';
  return 'AUTRE';
}

function detectRegion(location, description) {
  const text = `${location || ''} ${description || ''}`.toLowerCase();
  for (const [region, keywords] of Object.entries(REGIONS_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return region;
    }
  }
  return null;
}

// Filtre : est-ce que l'offre est bien pharma ?
function isPharmaRelated(title, description, company) {
  const fullText = `${title} ${description} ${company}`.toLowerCase();
  const pharmaKeywords = [
    'pharma', 'laboratoire', 'médicament', 'medicament', 'santé', 'sante',
    'médical', 'medical', 'hospitalier', 'thérapeutique', 'therapeutique',
    'biotech', 'healthcare', 'pharmaceutique', 'clinique', 'pharmacien',
    'amm', 'princeps', 'générique', 'generique', 'biologique', 'biosimilaire',
    'diagnostic', 'dispositif médical', 'dispositif medical'
  ];
  return pharmaKeywords.some(kw => fullText.includes(kw));
}

export function parseOffers(rawResults) {
  const parsed = [];
  const stats = {
    total: rawResults.length,
    noCompany: 0,
    noFonction: 0,
    notPharma: 0,
    kept: 0,
    duplicates: 0
  };
  const sampleNoPharma = [];
  
  for (const result of rawResults) {
    const title = result.title || '';
    const company = (result.company || '').trim();
    const description = result.description || '';
    const location = result.location || '';
    
    // Filtre 1 : doit avoir un labo (company)
    if (!company) {
      stats.noCompany++;
      continue;
    }
    
    // Filtre 2 : doit être une fonction qui nous intéresse
    const fonction = detectFonction(`${title} ${description}`);
    if (fonction === 'AUTRE') {
      stats.noFonction++;
      continue;
    }
    
    // Filtre 3 : doit être pharma-related (pour éviter le bruit)
    if (!isPharmaRelated(title, description, company)) {
      stats.notPharma++;
      if (sampleNoPharma.length < 3) {
        sampleNoPharma.push({ title, company });
      }
      continue;
    }
    
    parsed.push({
      labo: normalizeLabo(company),
      titre: title.substring(0, 300),
      fonction,
      region: detectRegion(location, description),
      source: detectSourceFromLink(result.link, result.via),
      url: result.link || `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + company)}`,
      date_publication: null
    });
    stats.kept++;
  }
  
  // Déduplication par URL
  const seen = new Set();
  const unique = [];
  for (const offer of parsed) {
    if (!seen.has(offer.url)) {
      seen.add(offer.url);
      unique.push(offer);
    } else {
      stats.duplicates++;
    }
  }
  
  console.log(`[PARSER] Stats:`, JSON.stringify(stats));
  if (sampleNoPharma.length > 0) {
    console.log(`[PARSER] Échantillon filtrés (non-pharma):`, JSON.stringify(sampleNoPharma));
  }
  if (unique.length > 0) {
    console.log(`[PARSER] Exemple offre gardée:`, JSON.stringify(unique[0]));
  }
  
  return unique;
}

function detectSourceFromLink(link, via) {
  const s = `${link || ''} ${via || ''}`.toLowerCase();
  if (s.includes('apec')) return 'apec';
  if (s.includes('indeed')) return 'indeed';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('francetravail') || s.includes('pole-emploi')) return 'france-travail';
  if (s.includes('hellowork')) return 'hellowork';
  if (s.includes('welcometothejungle')) return 'wttj';
  if (s.includes('monster')) return 'monster';
  if (s.includes('regionsjob') || s.includes('cadreemploi')) return 'regionsjob';
  return 'google-jobs';
}

function normalizeLabo(labo) {
  const normalizations = {
    'Merck': 'MSD',
    'BMS': 'Bristol Myers Squibb',
    'Pileje': 'PiLeJe',
    'Thea': 'Théa',
    'Leo Pharma': 'Léo Pharma',
    'Grunenthal': 'Grünenthal',
    'Viatris': 'Mylan/Viatris',
    'Mylan': 'Mylan/Viatris',
    'Sanofi Aventis': 'Sanofi',
    'Sanofi Genzyme': 'Sanofi',
    'Sanofi Pasteur': 'Sanofi',
    'MSD France': 'MSD',
    'Pfizer France': 'Pfizer',
    'Novartis France': 'Novartis',
    'Roche France': 'Roche',
    'AstraZeneca France': 'AstraZeneca',
    'GSK France': 'GSK',
    'Bayer France': 'Bayer',
    'Bayer Healthcare': 'Bayer',
    'Takeda France': 'Takeda',
  };
  return normalizations[labo] || labo;
}
