// api/lab-action.js
// Endpoint pour marquer un labo : contacté, ignoré, ou réactiver
// POST /api/lab-action { labo: "Sanofi", status: "contacted" | "ignored" | "reset", notes?: "..." }

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { labo, status, notes } = req.body || {};
  
  if (!labo || !status) {
    return res.status(400).json({ error: 'labo et status requis' });
  }
  
  if (!['contacted', 'ignored', 'in_progress', 'reset'].includes(status)) {
    return res.status(400).json({ error: 'status invalide' });
  }
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  try {
    if (status === 'reset') {
      // Supprime l'action pour réactiver le labo dans le dashboard
      const { error } = await supabase
        .from('lab_actions')
        .delete()
        .eq('labo', labo);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('lab_actions')
        .upsert({
          labo,
          status,
          notes: notes || null,
          date_action: new Date().toISOString()
        });
      if (error) throw error;
    }
    
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

