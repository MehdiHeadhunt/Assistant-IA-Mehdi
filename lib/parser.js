// lib/parser.js
// Parse les résultats Serper pour extraire labo, fonction, région

// Liste blanche/repère des labos pharma majeurs en France
// Sert à reconnaître plus fiablement le labo dans le titre/snippet
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
  'Nanobiotix', 'Onxeo', 'Inventiva', 'Adocia', 'Abivax', 'Valneva'
];

// Régions / villes principales
const REGIONS_KEYWORDS = {
  'IDF': ['ile-de-france', 'île-de-france', 'paris', 'idf', '75', '92', '93', '94', '95', '77', '78', '91'],
  'Nord': ['lille', 'nord', 'hauts-de-france', 'amiens', 'arras', 'dunkerque'],
  'Est': ['strasbourg', 'metz', 'nancy', 'reims', 'mulhouse', 'grand est', 'alsace', 'lorraine'],
  'Ouest': ['nantes', 'rennes', 'brest', 'angers', 'le mans', 'bretagne', 'pays de la loire'],
  'Sud-Ouest': ['bordeaux', 'toulouse', 'pau', 'bayonne', 'limoges', 'nouvelle-aquitaine', 'occitanie'],
  'Sud-Est': ['lyon', 'grenoble', 'saint-etienne', 'auvergne-rhône-alpes', 'rhône-alpes', 'aura'],
  'PACA': ['marseille', 'nice', 'aix-en-provence', 'toulon', 'avignon', 'paca', 'provence'],
  'Centre': ['orléans', 'tours', 'bourges', 'centre-val de loire'],
  'Normandie': ['rouen', 'caen', 'le havre', 'normandie'],
  'Bourgogne': ['dijon', 'besançon', 'bourgogne', 'franche-comté'],
};

// Fonctions terrain
function detectFonction(text) {
  const t = text.toLowerCase();
  if (/directeur\s+(des\s+)?ventes|directeur\s+commercial/.test(t)) return 'DSV';
  if (/directeur\s+de\s+zone/.test(t)) return 'DZ';
  if (/directeur\s+régional|directeur\s+regional/.test(t)) return 'DR';
  if (/key\s+account|kam\b/.test(t)) return 'KAM';
  if (/responsable\s+régional/.test(t)) return 'RR';
  if (/visiteur\s+médical|délégué\s+médical|délégué\s+pharmaceutique|delegue\s+medical/.test(t)) return 'VM';
  return 'AUTRE';
}

// Labo : on cherche d'abord dans la liste connue, sinon on essaie d'extraire
function detectLabo(title, snippet, link) {
  const fullText = `${title} ${snippet}`;
  
  // 1. Match sur la liste blanche
  for (const lab of KNOWN_LABS) {
    const regex = new RegExp(`\\b${lab.replace(/\+/g, '\\+').replace(/ /g, '\\s+')}\\b`, 'i');
    if (regex.test(fullText)) {
      return lab;
    }
  }
  
  // 2. Pattern courant Apec : "Entreprise - Titre du poste"
  const apecMatch = title.match(/^([^-—|]+)[\s\-—|]+/);
  if (apecMatch && apecMatch[1].length > 3 && apecMatch[1].length < 50) {
    const candidate = apecMatch[1].trim();
    // Filtres pour éviter les faux positifs (on évite les titres de poste)
    if (!/visiteur|délégué|directeur|responsable|manager|cadre|chef/i.test(candidate)) {
      return candidate;
    }
  }
  
  // 3. Pattern Indeed : souvent "Titre - Entreprise - Lieu"
  const indeedMatch = title.match(/-\s*([A-Z][\w\s&\-\.]+?)\s*-\s*[A-Z]/);
  if (indeedMatch && indeedMatch[1].length > 2 && indeedMatch[1].length < 50) {
    return indeedMatch[1].trim();
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
  return 'autre';
}

export function parseOffers(rawResults) {
  const parsed = [];
  
  for (const result of rawResults) {
    const fullText = `${result.title} ${result.snippet}`;
    const labo = detectLabo(result.title, result.snippet, result.link);
    
    // On garde uniquement si on a réussi à identifier un labo
    if (!labo) continue;
    
    const fonction = detectFonction(fullText);
    
    // On garde uniquement les fonctions qui nous intéressent
    if (fonction === 'AUTRE') continue;
    
    parsed.push({
      labo: normalizeLabo(labo),
      titre: result.title.substring(0, 300),
      fonction,
      region: detectRegion(fullText),
      source: detectSource(result.link),
      url: result.link,
      date_publication: null
    });
  }
  
  // Déduplication par URL
  const seen = new Set();
  const unique = [];
  for (const offer of parsed) {
    if (!seen.has(offer.url)) {
      seen.add(offer.url);
      unique.push(offer);
    }
  }
  
  return unique;
}

// Normalise le nom du labo pour éviter les doublons (ex: "MSD" et "Merck" → "MSD")
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
  };
  return normalizations[labo] || labo;
}

