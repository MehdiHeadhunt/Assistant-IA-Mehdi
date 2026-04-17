// lib/parser.js
// V4 : adapté aux URLs d'offres individuelles
// Cherche le labo dans titre + snippet + URL avec une whitelist étendue et des patterns robustes

const KNOWN_LABS = [
  // Big Pharma international
  'Sanofi', 'Pfizer', 'Novartis', 'AstraZeneca', 'GSK', 'Roche',
  'Merck', 'MSD', 'Bayer', 'Boehringer', 'Lilly', 'Eli Lilly', 'Janssen', 'Bristol Myers Squibb',
  'BMS', 'Takeda', 'Novo Nordisk', 'Biogen', 'AbbVie', 'Amgen', 'Ipsen',
  'Johnson & Johnson', 'J&J',
  // Français
  'Servier', 'Pierre Fabre', 'Théa', 'Thea', 'Effik', 'PiLeJe', 'Pileje', 'EA Pharma',
  'LFB', 'Biocodex', 'Bouchara Recordati', 'Recordati', 'Urgo', 'Biogaran',
  'Mayoly', 'Mayoly Spindler', 'Bioprojet', 'Guerbet', 'Expanscience',
  'Laboratoires Expanscience', 'Laboratoires Gilbert', 'Gilbert', 'Laboratoires Boiron', 'Boiron',
  'Cooper', 'Laboratoires Cooper', 'Besins', 'Besins Healthcare',
  // Génériques
  'Mylan', 'Viatris', 'Teva', 'Sandoz', 'Arrow', 'Zentiva', 'Biogaran',
  // Spécialités
  'Menarini', 'Gilead', 'Vertex', 'Alexion', 'Chiesi', 'Galapagos',
  'CSL Behring', 'Octapharma', 'Astellas', 'UCB', 'Lundbeck', 'Otsuka',
  'Daiichi Sankyo', 'Daiichi-Sankyo', 'Eisai', 'Mundipharma', 'Norgine',
  'Almirall', 'Stallergenes', 'Stallergenes Greer', 'Grünenthal', 'Grunenthal',
  'Léo Pharma', 'Leo Pharma', 'Vifor Pharma', 'Sobi', 'Incyte', 'Ferring',
  'Rovi', 'IBSA', 'Allergan', 'Ferring Pharmaceuticals', 'Shire',
  'Jazz Pharmaceuticals', 'BioMarin', 'Regeneron', 'Moderna', 'BioNTech',
  'Kyowa Kirin', 'Alnylam', 'Orphalan', 'Amryt', 'Tillotts', 'Helsinn',
  'Exeltis', 'Zambon', 'Gedeon Richter', 'Polpharma', 'Krka',
  // Biotechs FR
  'Innate Pharma', 'Cellectis', 'DBV Technologies', 'Genfit', 'Erytech',
  'Nanobiotix', 'Onxeo', 'Inventiva', 'Adocia', 'Abivax', 'Valneva',
  // OTC / grand public
  'Reckitt', 'Reckitt Benckiser', 'GSK Consumer', 'Sanofi CHC', 'Haleon',
  'Omega Pharma', 'Perrigo', 'Johnson & Johnson Consumer',
  // Nutrition / médicale
  'Nutricia', 'Danone Nutricia', 'Nestlé Health Science', 'Nestle Health Science',
  // Medtech (plusieurs labos embauchent des profils terrain)
  'Medtronic', 'Boston Scientific', 'Abbott', 'Stryker', 'Zimmer Biomet',
  'B. Braun', 'Fresenius', 'Baxter', 'Terumo', 'Edwards Lifesciences',
  'Getinge', 'Hologic', 'Cook Medical', 'Smith & Nephew', 'Coloplast', 'Convatec',
  'GE Healthcare', 'Siemens Healthineers', 'Philips Healthcare', 'Bracco'
];

const REGIONS_KEYWORDS = {
  'IDF': ['ile-de-france', 'île-de-france', 'paris', 'idf', 'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', 'yvelines', 'essonne', 'nanterre', 'boulogne', 'neuilly', 'levallois', 'issy'],
  'Nord': ['lille', 'nord', 'hauts-de-france', 'amiens', 'arras', 'dunkerque', 'valenciennes', 'roubaix'],
  'Est': ['strasbourg', 'metz', 'nancy', 'reims', 'mulhouse', 'grand est', 'alsace', 'lorraine', 'champagne', 'colmar'],
  'Ouest': ['nantes', 'rennes', 'brest', 'angers', 'le mans', 'bretagne', 'pays de la loire', 'saint-nazaire', 'vannes'],
  'Sud-Ouest': ['bordeaux', 'toulouse', 'pau', 'bayonne', 'limoges', 'nouvelle-aquitaine', 'occitanie', 'montpellier', 'perpignan', 'nimes', 'nîmes'],
  'Sud-Est': ['lyon', 'grenoble', 'saint-etienne', 'saint-étienne', 'auvergne-rhône-alpes', 'rhône-alpes', 'annecy', 'chambéry', 'clermont'],
  'PACA': ['marseille', 'nice', 'aix-en-provence', 'toulon', 'avignon', 'paca', 'provence', 'cannes', 'antibes'],
  'Centre': ['orléans', 'tours', 'bourges', 'centre-val de loire', 'chartres'],
  'Normandie': ['rouen', 'caen', 'le havre', 'normandie'],
  'Bourgogne': ['dijon', 'besançon', 'bourgogne', 'franche-comté', 'mâcon'],
};

function detectFonction(text) {
  const t = (text || '').toLowerCase();
  if (/directeur\s+(des\s+)?ventes|directeur\s+commercial/.test(t)) return 'DSV';
  if (/directeur\s+de\s+zone/.test(t)) return 'DZ';
  if (/directeur\s+régional|directeur\s+regional/.test(t)) return 'DR';
  if (/key\s+account|\bkam\b/.test(t)) return 'KAM';
  if (/responsable\s+régional|responsable\s+regional/.test(t)) return 'RR';
  if (/visiteur\s+médical|visiteur\s+medical|délégué\s+médical|delegue\s+medical|délégué\s+pharmaceutique|delegue\s+pharmaceutique|attaché\s+scientifique/.test(t)) return 'VM';
  return 'AUTRE';
}

function detectLabo(title, snippet, link) {
  const fullText = `${title} ${snippet}`;
  const lowerLink = (link || '').toLowerCase();
  
  // 1. Match sur la whitelist
  for (const lab of KNOWN_LABS) {
    const escaped = lab.replace(/\+/g, '\\+').replace(/\./g, '\\.').replace(/&/g, '&').replace(/ /g, '\\s+');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(fullText)) return lab;
    // Check aussi dans l'URL (cas où le labo a son propre site carrières)
    const labInUrl = lab.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (labInUrl.length > 4 && lowerLink.includes(labInUrl)) return lab;
  }
  
  // 2. Patterns d'extraction depuis titre/snippet
  const patterns = [
    // "Entreprise recrute un Visiteur Médical"
    /^([A-ZÀ-Ÿ][\wÀ-ÿ&\-\.'\s]{2,40}?)\s+recrute/i,
    // "Rejoignez Entreprise"
    /rejoignez\s+([A-ZÀ-Ÿ][\wÀ-ÿ&\-\.'\s]{2,40}?)(?:\s+[\-–—\|,]|\s*!|\s+en\s+|\s+dès\s+)/i,
    // "chez Entreprise"
    /chez\s+([A-ZÀ-Ÿ][\wÀ-ÿ&\-\.'\s]{2,40}?)(?:\s+[\-–—\|,]|\s*$|\s+en\s+|\s+pour\s+|\s+est\s+)/i,
    // "travailler chez Entreprise"
    /travailler\s+(?:chez|pour)\s+([A-ZÀ-Ÿ][\wÀ-ÿ&\-\.'\s]{2,40}?)(?:\s+[\-–—\|,]|\s*$)/i,
    // "intégrer Entreprise"
    /intégrer\s+([A-ZÀ-Ÿ][\wÀ-ÿ&\-\.'\s]{2,40}?)(?:\s+[\-–—\|,]|\s*$)/i,
  ];
  
  for (const pat of patterns) {
    const match = fullText.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && candidate.length < 50 &&
          !/visiteur|délégué|delegue|directeur|responsable|manager|cadre|chef|poste|emploi|recrutement|consultant|candidat/i.test(candidate) &&
          !/^(le|la|les|un|une|des|notre|son|nos|cette|ce|ces|mon|ma)$/i.test(candidate)) {
        return candidate;
      }
    }
  }
  
  return null;
}

function detectRegion(text) {
  const t = (text || '').toLowerCase();
  for (const [region, keywords] of Object.entries(REGIONS_KEYWORDS)) {
    for (const kw of keywords) {
      if (t.includes(kw)) return region;
    }
  }
  return null;
}

function detectSource(link) {
  const l = (link || '').toLowerCase();
  if (l.includes('apec.fr')) return 'apec';
  if (l.includes('indeed')) return 'indeed';
  if (l.includes('linkedin.com')) return 'linkedin';
  if (l.includes('francetravail') || l.includes('pole-emploi')) return 'france-travail';
  if (l.includes('hellowork')) return 'hellowork';
  if (l.includes('welcometothejungle')) return 'wttj';
  if (l.includes('monster')) return 'monster';
  if (l.includes('regionsjob') || l.includes('cadreemploi')) return 'regionsjob';
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
          title: (result.title || '').substring(0, 120),
          snippet: (result.snippet || '').substring(0, 120)
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
      titre: (result.title || '').substring(0, 300),
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
    if (offer.url && !seen.has(offer.url)) {
      seen.add(offer.url);
      unique.push(offer);
    } else if (offer.url) {
      stats.duplicates++;
    }
  }
  
  console.log(`[PARSER] Stats:`, JSON.stringify(stats));
  if (sampleNoLabo.length > 0) {
    console.log(`[PARSER] Échantillon sans labo détecté:`, JSON.stringify(sampleNoLabo, null, 2));
  }
  if (unique.length > 0) {
    console.log(`[PARSER] Exemple offre gardée:`, JSON.stringify(unique[0]));
  }
  
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
    'Sanofi CHC': 'Sanofi',
    'MSD France': 'MSD',
    'Pfizer France': 'Pfizer',
    'Novartis France': 'Novartis',
    'Roche France': 'Roche',
    'AstraZeneca France': 'AstraZeneca',
    'GSK France': 'GSK',
    'GSK Consumer': 'GSK',
    'Bayer France': 'Bayer',
    'Bayer Healthcare': 'Bayer',
    'Takeda France': 'Takeda',
    'Eli Lilly': 'Lilly',
    'J&J': 'Johnson & Johnson',
    'Johnson & Johnson Consumer': 'Johnson & Johnson',
    'Daiichi-Sankyo': 'Daiichi Sankyo',
    'Reckitt Benckiser': 'Reckitt',
    'Nestlé Health Science': 'Nestle Health Science',
    'Stallergenes Greer': 'Stallergenes',
    'Laboratoires Expanscience': 'Expanscience',
    'Laboratoires Gilbert': 'Gilbert',
    'Laboratoires Boiron': 'Boiron',
    'Laboratoires Cooper': 'Cooper',
    'Ferring Pharmaceuticals': 'Ferring',
    'Besins Healthcare': 'Besins',
  };
  return normalizations[labo] || labo;
}
