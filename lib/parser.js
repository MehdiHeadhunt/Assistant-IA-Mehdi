// lib/parser.js
// V5 : adapté au format France Travail
// L'entreprise est directement dans result.company, plus besoin d'extraction

const REGIONS_BY_DEPT = {
  'IDF': ['75', '77', '78', '91', '92', '93', '94', '95'],
  'Nord': ['59', '62', '02', '80', '60'],
  'Est': ['67', '68', '54', '55', '57', '88', '51', '10', '52', '08'],
  'Ouest': ['44', '49', '53', '72', '85', '35', '22', '29', '56'],
  'Sud-Ouest': ['33', '24', '40', '47', '64', '16', '17', '79', '86', '19', '23', '87', '31', '09', '12', '32', '46', '65', '81', '82', '34', '11', '30', '48', '66'],
  'Sud-Est': ['69', '01', '07', '26', '38', '42', '73', '74', '03', '15', '43', '63'],
  'PACA': ['13', '04', '05', '06', '83', '84'],
  'Centre': ['18', '28', '36', '37', '41', '45'],
  'Normandie': ['14', '27', '50', '61', '76'],
  'Bourgogne': ['21', '58', '71', '89', '25', '39', '70', '90']
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

function detectRegionFromDept(dept) {
  for (const [region, depts] of Object.entries(REGIONS_BY_DEPT)) {
    if (depts.includes(dept)) return region;
  }
  return null;
}

// On garde uniquement si c'est lié au pharma/santé/laboratoire
function isPharmaRelated(title, description, company) {
  const text = `${title} ${description} ${company}`.toLowerCase();
  const keywords = [
    'pharma', 'laboratoire', 'médicament', 'medicament', 'santé', 'sante',
    'médical', 'medical', 'hospitalier', 'thérapeutique', 'therapeutique',
    'biotech', 'healthcare', 'pharmaceutique', 'officine', 'pharmacien',
    'princeps', 'générique', 'generique', 'biologique', 'biosimilaire',
    'dispositif médical', 'dispositif medical', 'clinique', 'vaccin',
    'diagnostic', 'biomédical', 'biomedical'
  ];
  return keywords.some(kw => text.includes(kw));
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
  const sampleNotPharma = [];
  
  for (const result of rawResults) {
    const company = (result.company || '').trim();
    const title = result.title || '';
    const description = result.description || '';
    
    if (!company) {
      stats.noCompany++;
      continue;
    }
    
    const fonction = detectFonction(`${title} ${description}`);
    if (fonction === 'AUTRE') {
      stats.noFonction++;
      continue;
    }
    
    if (!isPharmaRelated(title, description, company)) {
      stats.notPharma++;
      if (sampleNotPharma.length < 3) {
        sampleNotPharma.push({ title: title.substring(0, 80), company });
      }
      continue;
    }
    
    parsed.push({
      labo: normalizeLabo(company),
      titre: title.substring(0, 300),
      fonction,
      region: detectRegionFromDept(result.departement),
      source: 'france-travail',
      url: result.url,
      date_publication: result.date_creation ? result.date_creation.substring(0, 10) : null
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
  if (sampleNotPharma.length > 0) {
    console.log(`[PARSER] Échantillon filtrés (non-pharma):`, JSON.stringify(sampleNotPharma));
  }
  if (unique.length > 0) {
    console.log(`[PARSER] Exemple offre gardée:`, JSON.stringify(unique[0]));
  }
  
  return unique;
}

function normalizeLabo(labo) {
  // Nettoyage : France Travail met souvent des suffixes genre "SANOFI FRANCE" ou "SANOFI PASTEUR"
  const normalizations = {
    'MSD FRANCE': 'MSD',
    'MERCK': 'MSD',
    'SANOFI AVENTIS': 'Sanofi',
    'SANOFI GENZYME': 'Sanofi',
    'SANOFI PASTEUR': 'Sanofi',
    'SANOFI CHC': 'Sanofi',
    'SANOFI FRANCE': 'Sanofi',
    'SANOFI-AVENTIS FRANCE': 'Sanofi',
    'PFIZER FRANCE': 'Pfizer',
    'PFIZER SAS': 'Pfizer',
    'NOVARTIS PHARMA': 'Novartis',
    'NOVARTIS FRANCE': 'Novartis',
    'ROCHE FRANCE': 'Roche',
    'ROCHE SAS': 'Roche',
    'ASTRAZENECA FRANCE': 'AstraZeneca',
    'GSK FRANCE': 'GSK',
    'BAYER FRANCE': 'Bayer',
    'BAYER HEALTHCARE': 'Bayer',
    'TAKEDA FRANCE': 'Takeda',
    'SERVIER FRANCE': 'Servier',
    'LES LABORATOIRES SERVIER': 'Servier',
    'PIERRE FABRE MEDICAMENT': 'Pierre Fabre',
    'LABORATOIRES PIERRE FABRE': 'Pierre Fabre',
    'EFFIK': 'Effik',
    'PILEJE': 'PiLeJe',
    'MYLAN': 'Mylan/Viatris',
    'VIATRIS': 'Mylan/Viatris',
  };
  const upper = labo.toUpperCase();
  if (normalizations[upper]) return normalizations[upper];
  // Sinon on capitalise proprement
  return labo
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
