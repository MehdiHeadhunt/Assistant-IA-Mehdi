// lib/parser.js
// V2 : parser plus permissif + logs détaillés

const KNOWN_LABS = [
  'Sanofi', 'Servier', 'Pfizer', 'Novartis', 'AstraZeneca', 'GSK', 'Roche',
  'Merck', 'MSD', 'Bayer', 'Boehringer', 'Lilly', 'Janssen', 'Bristol Myers Squibb',
  'BMS', 'Takeda', 'Novo Nordisk', 'Biogen', 'AbbVie', 'Amgen', 'Ipsen',
  'Pierre Fabre', 'Théa', 'Thea', 'Effik', 'PiLeJe', 'Pileje', 'EA Pharma',
  'Mylan', 'Viatris', 'Teva', 'Biocodex', 'Bouchara Recordati', 'Recordati',
  'Menarini', 'Sandoz', 'Mayoly', 'Gilead', 'Vertex', 'Alexion', 'Chiesi',
  'Galapagos', 'CSL Behring', 'Octapharma', 'LFB', 'Genzyme', 'Astellas',
  'UCB', 'Lundbeck', 'Otsuka', 'Daiichi Sankyo', 'Eisai', 'Mundipharma',
  'Norgine', 'Almirall', 'Stallergenes', 'Urgo', 'Biogaran', 'Mayoli Spindler',
  'Biotest', 'Grünenthal', 'Grunenthal', 'Léo Pharma', 'Leo Pharma',
  'Vifor Pharma', 'Sobi', 'Incyte', 'Ferring', 'Rovi', 'IBSA',
  'Bausch + Lomb', 'Allergan', 'BiogenIdec', 'Sanofi Pasteur', 'Vaxinova',
  'Innate Pharma', 'Cellectis', 'DBV Technologies', 'Genfit', 'Erytech',
  'Nanobiotix', 'Onxeo', 'Inventiva', 'Adocia', 'Abivax', 'Valneva',
  'Expanscience', 'Laboratoires Expanscience', 'Biogaran', 'Arrow Génériques',
  'Zentiva', 'Bracco', 'Guerbet', 'Nutricia', 'Danone Nutricia',
  'Reckitt Benckiser', 'Johnson & Johnson', 'Bayer Healthcare',
  'Sanofi Aventis', 'Sanofi Genzyme', 'MSD France', 'Pfizer France',
  'Merck Serono', 'Daiichi-Sankyo', 'Kyowa Kirin', 'Shire', 'Alnylam',
  'Jazz Pharmaceuticals', 'BioMarin', 'Regeneron', 'Moderna', 'BioNTech',
  'Bioprojet', 'Guerbet', 'Bausch', 'Lundbeck', 'Exeltis',
  'Zambon', 'Gedeon Richter', 'Polpharma', 'Krka', 'Aristo', 'Pharmanovia',
  'Symbiotec', 'Intersystems', 'Pharmacare', 'Orion Pharma', 'Desitin',
  'Tillotts', 'Helsinn', 'Amryt', 'Orphalan', 'Dompé', 'Meda', 'Mylan EPD',
  'Thuasne', 'Lohmann & Rauscher', 'Smith & Nephew', 'Convatec', 'Coloplast',
  'Medela', 'Dräger', 'Masimo', 'GE Healthcare', 'Siemens Healthineers',
  'Philips Healthcare', 'Medtronic', 'Boston Scientific', 'Abbott',
  'Stryker', 'Zimmer Biomet', 'B. Braun', 'Fresenius', 'Baxter',
  'Terumo', 'Edwards Lifesciences', 'Getinge', 'Hologic', 'Cook Medical'
];

const REGIONS_KEYWORDS = {
  'IDF': ['ile-de-france', 'île-de-france', 'paris', 'idf', 'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', 'val-d\'oise', 'seine-et-marne', 'yvelines', 'essonne', 'nanterre', 'boulogne'],
  'Nord': ['lille', 'nord', 'hauts-de-france', 'amiens', 'arras', 'dunkerque', 'valenciennes'],
  'Est': ['strasbourg', 'metz', 'nancy', 'reims', 'mulhouse', 'grand est', 'alsace', 'lorraine', 'champagne'],
  'Ouest': ['nantes', 'rennes', 'brest', 'angers', 'le mans', 'bretagne', 'pays de la loire'],
  'Sud-Ouest': ['bordeaux', 'toulouse', 'pau', 'bayonne', 'limoges', 'nouvelle-aquitaine', 'occitanie', 'montpellier', 'perpignan'],
  'Sud-Est': ['lyon', 'grenoble', 'saint-etienne', 'saint-étienne', 'auvergne-rhône-alpes', 'rhône-alpes', 'aura', 'annecy', 'chambéry'],
  'PACA': ['marseille', 'nice', 'aix-en-provence', 'toulon', 'avignon', 'paca', 'provence', 'côte d\'azur'],
  'Centre': ['orléans', 'tours', 'bourges', 'centre-val de loire'],
  'Normandie': ['rouen', 'caen', 'le havre', 'normandie'],
  'Bourgogne': ['dijon', 'besançon', 'bourgogne', 'franche-comté'],
};

function detectFonction(text) {
  const t = text.toLowerCase();
  if (/directeur\s+(des\s+)?ventes|directeur\s+commercial/.test(t)) return 'DSV';
  if (/directeur\s+de\s+zone/.test(t)) return 'DZ';
  if (/directeur\s+régional|directeur\s+regional/.test(t)) return 'DR';
  if (/key\s+account|kam\b/.test(t)) return 'KAM';
  if (/responsable\s+régional|responsable\s+regional/.test(t)) return 'RR';
  if (/visiteur\s+médical|visiteur\s+medical|délégué\s+médical|delegue\s+medical|délégué\s+pharmaceutique|delegue\s+pharmaceutique/.test(t)) return 'VM';
  return 'AUTRE';
}

function detectLabo(title, snippet, link) {
  const fullText = `${title} ${snippet}`;
  
  // 1. Match strict sur la liste blanche
  for (const lab of KNOWN_LABS) {
    const escaped = lab.replace(/\+/g, '\\+').replace(/\./g, '\\.').replace(/ /g, '\\s+');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(fullText)) {
      return lab;
    }
  }
  
  // 2. Patterns extraction depuis le titre - Apec format "Entreprise | Titre" ou "Entreprise - Titre"
  const patterns = [
    /^([A-ZÀ-Ÿ][\w\s&\-\.'éèêàâîôûç]+?)\s+[\|\-—]\s+/,  // "LaboX - Visiteur..."
    /^([A-ZÀ-Ÿ][\w\s&\-\.'éèêàâîôûç]+?)\s+recrute/i,     // "LaboX recrute..."
    /chez\s+([A-ZÀ-Ÿ][\w\s&\-\.'éèêàâîôûç]+?)(?:\s+[\-–—\|]|\s*$|\s+en\s+)/i,  // "...chez LaboX"
    /rejoignez\s+([A-ZÀ-Ÿ][\w\s&\-\.'éèêàâîôûç]+?)(?:\s+[\-–—\|]|\s*$|\s*,)/i,  // "Rejoignez LaboX"
  ];
  
  for (const pat of patterns) {
    const match = fullText.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filtres anti-faux positifs
      if (candidate.length > 2 && candidate.length < 50 &&
          !/visiteur|délégué|delegue|directeur|responsable|manager|cadre|chef|poste|emploi|recrutement|consultant|pharma\b|médical|laboratoire\b/i.test(candidate)) {
        return candidate;
      }
    }
  }
  
  return null;
}

function detectRegion(text) {
  const t = text.toLowerCase();
  for (const [region, keywords] of Object.entries(REGIONS_KEYWORDS)) {
    for (const kw of keywords) {
      if (t.includes(kw)) return region;
    }
  }
  return null;
}

function detectSource(link) {
  if (link.includes('apec.fr')) return 'apec';
  if (link.includes('indeed')) return 'indeed';
  if (link.includes('linkedin.com')) return 'linkedin';
  if (link.includes('francetravail') || link.includes('pole-emploi')) return 'france-travail';
  if (link.includes('hellowork')) return 'hellowork';
  if (link.includes('welcometothejungle')) return 'wttj';
  if (link.includes('jobteaser')) return 'jobteaser';
  if (link.includes('monster')) return 'monster';
  if (link.includes('regionsjob') || link.includes('cadreemploi')) return 'regionsjob';
  if (link.includes('pharmaspecialties') || link.includes('pharmajob')) return 'pharmajob';
  return 'autre';
}

export function parseOffers(rawResults) {
  const parsed = [];
  const stats = {
    total: rawResults.length,
    noLabo: 0,
    noFonction: 0,
    kept: 0,
    duplicates: 0
  };
  const sampleNoLabo = [];
  
  for (const result of rawResults) {
    const fullText = `${result.title} ${result.snippet}`;
    const labo = detectLabo(result.title, result.snippet, result.link);
    
    if (!labo) {
      stats.noLabo++;
      if (sampleNoLabo.length < 5) {
        sampleNoLabo.push({
          title: result.title.substring(0, 100),
          snippet: result.snippet.substring(0, 100)
        });
      }
      continue;
    }
    
    const fonction = detectFonction(fullText);
    if (fonction === 'AUTRE') {
      stats.noFonction++;
      continue;
    }
    
    parsed.push({
      labo: normalizeLabo(labo),
      titre: result.title.substring(0, 300),
      fonction,
      region: detectRegion(fullText),
      source: detectSource(result.link),
      url: result.link,
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
  console.log(`[PARSER] Échantillon de résultats sans labo détecté:`, JSON.stringify(sampleNoLabo, null, 2));
  
  return unique;
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
  };
  return normalizations[labo] || labo;
}
