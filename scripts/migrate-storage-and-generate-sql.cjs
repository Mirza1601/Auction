const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jsuegqbknolxiwmfppfl.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const BUCKET = 'player-photos';

const manifestPath = path.join(__dirname, '..', 'auction_nexus_full_backup', 'migration_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const defStatePath = path.join(__dirname, '..', 'auction_nexus_full_backup', 'default_profile', 'state.json');
const defState = JSON.parse(fs.readFileSync(defStatePath, 'utf8'));

const kkrStatePath = path.join(__dirname, '..', 'auction_nexus_full_backup', 'profile_kkr_srm', 'state.json');
const kkrState = JSON.parse(fs.readFileSync(kkrStatePath, 'utf8'));

async function uploadFile(remotePath, localFilePath, mimeType = 'image/jpeg') {
  const fileBuffer = fs.readFileSync(localFilePath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${remotePath}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SECRET_KEY,
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload failed for ${remotePath}: ${res.status} ${txt}`);
  }

  // Verify public retrieval
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${remotePath}`;
  const verifyRes = await fetch(publicUrl);
  if (!verifyRes.ok) {
    throw new Error(`Public verification failed for ${publicUrl}: ${verifyRes.status}`);
  }

  return publicUrl;
}

async function run() {
  console.log('=== STARTING SUPABASE STORAGE MIGRATION ===');

  const baseDir = path.join(__dirname, '..', 'auction_nexus_full_backup');
  const uploadResults = {};

  // 1. Upload Historical Default Profile Images
  console.log('\n1. Uploading Historical Default Profile Images (16)...');
  const defImgDir = path.join(baseDir, 'default_profile', 'player_images');
  for (const f of fs.readdirSync(defImgDir)) {
    const fullPath = path.join(defImgDir, f);
    const remotePath = `historical/default_profile/${f}`;
    const pubUrl = await uploadFile(remotePath, fullPath, 'image/jpeg');
    console.log(`  ✓ ${f} -> ${pubUrl}`);
  }

  // 2. Upload Historical KKR vs SRM Images
  console.log('\n2. Uploading Historical KKR vs SRM Images (16)...');
  const kkrImgDir = path.join(baseDir, 'profile_kkr_srm', 'player_images');
  for (const f of fs.readdirSync(kkrImgDir)) {
    const fullPath = path.join(kkrImgDir, f);
    const remotePath = `historical/profile_kkr_srm/${f}`;
    const pubUrl = await uploadFile(remotePath, fullPath, 'image/jpeg');
    console.log(`  ✓ ${f} -> ${pubUrl}`);
  }

  // 3. Define and Upload Master Players
  console.log('\n3. Uploading Permanent Master Player Images (22)...');
  
  // Mapping master player definition to image file
  const masterPlayerDefs = [
    { id: 'master_adeen', name: 'Adeen', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'rng5uxa0_adeen.jpeg') },
    { id: 'master_anzar', name: 'Anzar', role: 'Bowler', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'wwmz6b29_anzar.jpeg') },
    { id: 'master_arhan', name: 'Arhan', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'yuvqh05j_arhan.jpeg') },
    { id: 'master_ayaan', name: 'Ayaan', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'ui1dgr6s_ayaan.jpeg') },
    { id: 'master_farhan_allrounder', name: 'Farhan', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'jusl84dn_farhan.jpeg') },
    { id: 'master_farhan_batter', name: 'Farhan', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'b4rstv5z_farhan.jpeg') },
    { id: 'master_haseeb', name: 'Haseeb', role: 'Bowler', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, '64bdvd35_HASEEB.jpeg') },
    { id: 'master_kaif', name: 'Kaif', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, '4b0miih9_kaif.jpeg') },
    { id: 'master_loony', name: 'Loony', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, 'z2cwrr0n_LOONY.jpeg') },
    { id: 'master_moin', name: 'Moin', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, '693ml8qs_moin.jpeg') },
    { id: 'master_nabeel', name: 'Nabeel', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, 'fhjeyn23_NABEEL.jpeg') },
    { id: 'master_omar', name: 'Omar', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, 'tyv2zwnq_OMAR.jpeg') },
    { id: 'master_rayyan', name: 'Rayyan', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'shsd5lkk_rayyan.jpeg') },
    { id: 'master_razi', name: 'Razi', role: 'Bowler', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'dvlsv37l_razi.jpeg') },
    { id: 'master_rumaan', name: 'Rumaan', role: 'Bowler', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'wqu1gvzl_rumaan.jpeg') },
    { id: 'master_sami', name: 'Sami', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, '01rrwje9_SAMI.jpeg') },
    { id: 'master_tabrez', name: 'Tabrez', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'oepi6ize_tabrez.jpeg') },
    { id: 'master_unais', name: 'Unais', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'uyuedg7m_unais.jpeg') },
    { id: 'master_zabi', name: 'Zabi', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, 'uj61gs34_zabi.jpeg') },
    { id: 'master_zaid', name: 'Zaid', role: 'Batter', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, '8o1smdxe_zaid.jpeg') },
    { id: 'master_zaki', name: 'Zaki', role: 'Bowler', category: 'General', basePrice: 3.0, sourceImg: path.join(kkrImgDir, 'jeuvqjj3_ZAKI.jpeg') },
    { id: 'master_zuhair', name: 'Zuhair', role: 'All Rounder', category: 'General', basePrice: 3.0, sourceImg: path.join(defImgDir, '7yf5xe77_zuhair.jpeg') },
  ];

  const masterPlayerRecords = [];

  for (const m of masterPlayerDefs) {
    const ext = path.extname(m.sourceImg).toLowerCase() || '.jpeg';
    const remotePath = `players/${m.id}${ext}`;
    const pubUrl = await uploadFile(remotePath, m.sourceImg, 'image/jpeg');
    console.log(`  ✓ ${m.name} (${m.id}) -> ${pubUrl}`);

    // Find rich player stats if present in either state
    let stats = { matches: 0, runs: 0, wickets: 0, strikeRate: 0, economy: 0, battingStyle: '', bowlingStyle: '' };
    const pInDef = defState.playerPool.find(p => p.name.trim().toLowerCase() === m.name.toLowerCase() && (m.id.includes('batter') ? p.role === 'Batter' : true));
    const pInKkr = kkrState.playerPool.find(p => p.name.trim().toLowerCase() === m.name.toLowerCase());
    const matchedP = pInDef || pInKkr;
    if (matchedP) {
      stats = {
        matches: matchedP.matches || 0,
        runs: matchedP.runs || 0,
        wickets: matchedP.wickets || 0,
        strikeRate: matchedP.strikeRate || 0,
        economy: matchedP.economy || 0,
        battingStyle: matchedP.battingStyle || '',
        bowlingStyle: matchedP.bowlingStyle || ''
      };
      if (matchedP.category) m.category = matchedP.category;
      if (matchedP.role) m.role = matchedP.role;
    }

    masterPlayerRecords.push({
      ...m,
      photoUrl: pubUrl,
      stats
    });
  }

  // 4. Clean up test file
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/players/test.jpeg`, {
      method: 'DELETE',
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': `Bearer ${SECRET_KEY}`
      }
    });
  } catch (e) {}

  console.log(`\nAll 22 Master Player photos successfully uploaded and verified on CDN!`);

  // Write master players metadata JSON to backup
  const masterJsonPath = path.join(baseDir, 'master_players_migrated.json');
  fs.writeFileSync(masterJsonPath, JSON.stringify(masterPlayerRecords, null, 2), 'utf8');
  console.log(`Saved master players metadata to: ${masterJsonPath}`);

  return masterPlayerRecords;
}

run().catch(console.error);
