/**
 * Script to migrate stocks and stocks_testing collections to proper categories
 * 
 * Usage:
 *   Dry-Run:   node scripts/migrate_stocks.js
 *   Execution: EXECUTE=true node scripts/migrate_stocks.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyB_sA0peKgiDudDGks0RNlwq6cB0IOer1M",
  authDomain: "koperasi-unipdu.firebaseapp.com",
  projectId: "koperasi-unipdu",
  storageBucket: "koperasi-unipdu.firebasestorage.app",
  messagingSenderId: "10094241377",
  appId: "1:10094241377:web:d788174993244f0d33ec20",
  measurementId: "G-BCP472H8DE",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EXECUTE = process.env.EXECUTE === 'true';

// Category Rule Engine
function determineCategory(name, currentCategory) {
  const nameLower = name.toLowerCase().trim();

  // 1. Sembako (Core staple foods - Rice, Oil, Sugar, Flour, Eggs)
  const sembakoKeywords = ['beras', 'minyak', 'bimoli', 'fortune', 'sunco', 'sania', 'tropical', 'filma', 'gula', 'gulaku', 'tepung', 'segitiga biru', 'telur'];
  if (sembakoKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Sembako';
    if (nameLower.includes('beras')) sub = 'Beras';
    else if (nameLower.includes('minyak') || nameLower.includes('bimoli') || nameLower.includes('fortune') || nameLower.includes('sunco') || nameLower.includes('sania') || nameLower.includes('tropical') || nameLower.includes('filma')) sub = 'Minyak';
    else if (nameLower.includes('gula')) sub = 'Gula';
    else if (nameLower.includes('tepung')) sub = 'Tepung';
    else if (nameLower.includes('telur')) sub = 'Telur';
    return { kategori: 'Sembako', subKategori: sub };
  }

  // 2. Kebutuhan Rumah Tangga (Household Needs & Cleaning)
  const householdKeywords = [
    'rinso', 'so klin', 'soklin', 'daia', 'downy', 'molto', 'kispray', 
    'sunlight', 'mama lemon', 'mama lime', 'vixal', 'harpic', 'wipol', 
    'super pell', 'superpell', 'vape', 'soffel', 'baygon', 'hit', 
    'kapur barus', 'bagus fancy', 'kamper', 'seagull', 
    'sapu', 'lidi', 'sorok', 'spons', 'sponge', 'susemi', 'kemoceng', 'sulak', 
    'kresek', 'kantong plastik', 'bagus fancys'
  ];
  if (householdKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Lainnya';
    if (nameLower.includes('rinso') || nameLower.includes('so klin') || nameLower.includes('soklin') || nameLower.includes('daia') || nameLower.includes('downy') || nameLower.includes('molto') || nameLower.includes('kispray')) {
      sub = 'Detergen & Pewangi';
    } else if (nameLower.includes('sunlight') || nameLower.includes('mama lemon') || nameLower.includes('mama lime') || nameLower.includes('vixal') || nameLower.includes('harpic') || nameLower.includes('wipol') || nameLower.includes('super pell') || nameLower.includes('superpell')) {
      sub = 'Sabun Cuci & Pembersih';
    } else if (nameLower.includes('sapu') || nameLower.includes('lidi') || nameLower.includes('sorok') || nameLower.includes('spons') || nameLower.includes('sponge') || nameLower.includes('susemi') || nameLower.includes('kemoceng') || nameLower.includes('sulak')) {
      sub = 'Alat Kebersihan';
    } else if (nameLower.includes('vape') || nameLower.includes('soffel') || nameLower.includes('baygon') || nameLower.includes('hit') || nameLower.includes('kapur barus') || nameLower.includes('kamper') || nameLower.includes('seagull') || nameLower.includes('bagus fancy') || nameLower.includes('bagus fancys')) {
      sub = 'Pembasmi Serangga & Kamper';
    } else if (nameLower.includes('kresek') || nameLower.includes('kantong plastik')) {
      sub = 'Kantong Plastik';
    }
    return { kategori: 'Kebutuhan Rumah Tangga', subKategori: sub };
  }

  // 3. Perawatan Diri (Personal Care)
  const personalCareKeywords = [
    'biore', 'dettol', 'lifebuoy', 'lux', 'shampoo', 'pantene', 'clear', 'sunsilk', 'rejoice', 
    'pepsodent', 'sikat gigi', 'pasta gigi', 'sensodyne', 'close up', 'closeup', 
    'ellips', 'emeron', 'emina', 'wardah', 'kahf', 'garnier', 
    'tisu', 'tissue', 'jolly', 'plenty', 'paseo', 'tessa', 
    'cotton bud', 'cottonbud', 'charm', 'laurier', 'softex', 'pembalut'
  ];
  if (personalCareKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Lainnya';
    if (nameLower.includes('biore') || nameLower.includes('dettol') || nameLower.includes('lifebuoy') || nameLower.includes('lux') || nameLower.includes('pepsodent') || nameLower.includes('sikat gigi') || nameLower.includes('pasta gigi') || nameLower.includes('sensodyne') || nameLower.includes('close up') || nameLower.includes('closeup')) {
      sub = 'Kebersihan Tubuh';
    } else if (nameLower.includes('shampoo') || nameLower.includes('pantene') || nameLower.includes('clear') || nameLower.includes('sunsilk') || nameLower.includes('rejoice') || nameLower.includes('ellips') || nameLower.includes('emeron')) {
      sub = 'Perawatan Rambut';
    } else if (nameLower.includes('emina') || nameLower.includes('wardah') || nameLower.includes('kahf') || nameLower.includes('garnier')) {
      sub = 'Perawatan Wajah';
    } else if (nameLower.includes('tisu') || nameLower.includes('tissue') || nameLower.includes('jolly') || nameLower.includes('plenty') || nameLower.includes('paseo') || nameLower.includes('tessa')) {
      sub = 'Tisu & Kapas';
    } else if (nameLower.includes('cotton bud') || nameLower.includes('cottonbud')) {
      sub = 'Cotton Bud';
    } else if (nameLower.includes('charm') || nameLower.includes('laurier') || nameLower.includes('softex') || nameLower.includes('pembalut')) {
      sub = 'Kewanitaan';
    }
    return { kategori: 'Perawatan Diri', subKategori: sub };
  }

  // 4. Obat & Kesehatan
  const healthKeywords = [
    'antangin', 'fresh care', 'freshcare', 'paracetamol', 'panadol', 'bodrex', 'promag', 
    'diapet', 'sanaflu', 'decolgen', 'tolak angin', 'minyak kayu putih', 'kayu putih', 
    'balsam', 'betadine', 'plester', 'hansaplast', 'masker', 'vegeta'
  ];
  if (healthKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Obat-Obatan';
    if (nameLower.includes('plester') || nameLower.includes('hansaplast') || nameLower.includes('masker')) {
      sub = 'Alat Kesehatan';
    } else if (nameLower.includes('fresh care') || nameLower.includes('freshcare') || nameLower.includes('minyak kayu putih') || nameLower.includes('kayu putih')) {
      sub = 'Minyak Angin & Aromaterapi';
    } else if (nameLower.includes('vegeta')) {
      sub = 'Suplemen';
    }
    return { kategori: 'Obat & Kesehatan', subKategori: sub };
  }

  // 5. Peralatan & Hardware
  const hardwareKeywords = ['lampu', 'philips', 'morgen', 'hannochs', 'led', 'baterai', 'battery', 'abc aa', 'abc aaa', 'gayung', 'ember', 'colokan', 'kabel', 'fitting'];
  if (hardwareKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Peralatan Umum';
    if (nameLower.includes('lampu') || nameLower.includes('philips') || nameLower.includes('morgen') || nameLower.includes('hannochs') || nameLower.includes('led') || nameLower.includes('colokan') || nameLower.includes('kabel') || nameLower.includes('fitting')) {
      sub = 'Lampu & Elektronik';
    } else if (nameLower.includes('baterai') || nameLower.includes('battery') || nameLower.includes('abc aa') || nameLower.includes('abc aaa')) {
      sub = 'Baterai';
    }
    return { kategori: 'Peralatan & Hardware', subKategori: sub };
  }

  // 6. Pakaian & Atribut
  const apparelKeywords = ['songkok', 'peci', 'kopiah', 'seragam', 'kaos', 'atribut', 'logo', 'dasi', 'topi'];
  if (apparelKeywords.some(kw => nameLower.includes(kw))) {
    let sub = 'Aksesori & Atribut';
    if (nameLower.includes('songkok') || nameLower.includes('peci') || nameLower.includes('kopiah')) {
      sub = 'Songkok & Peci';
    } else if (nameLower.includes('seragam') || nameLower.includes('kaos')) {
      sub = 'Pakaian';
    }
    return { kategori: 'Pakaian & Atribut', subKategori: sub };
  }

  // 7. ATK
  const atkKeywords = [
    'kertas', 'hvs', 'sidu', 'paperline', 'buku', 'notebook', 'vision', 'nota', 
    'kuitansi', 'kwitansi', 'amplop', 'envelope', 'map', 'stopmap', 'spidol', 
    'marker', 'snowman', 'pulpen', 'pen', 'pilot', 'pensil', 'pencil', 
    'penghapus', 'eraser', 'tipex', 'tipe-x', 'stipo', 'ruler', 
    'penggaris', 'lakban', 'tape', 'isolasi', 'double tape', 'binder clip', 
    'gunting', 'stapler', 'hekter', 'tinta', 'epson', 'canon', 'universal'
  ];
  if (atkKeywords.some(kw => nameLower.includes(kw)) || currentCategory === 'ATK') {
    let sub = 'Alat Tulis';
    if (nameLower.includes('kertas') || nameLower.includes('hvs') || nameLower.includes('sidu') || nameLower.includes('paperline') || nameLower.includes('amplop') || nameLower.includes('envelope')) {
      sub = 'Kertas';
    } else if (nameLower.includes('buku') || nameLower.includes('notebook') || nameLower.includes('nota') || nameLower.includes('kuitansi') || nameLower.includes('kwitansi')) {
      sub = 'Buku';
    } else if (nameLower.includes('spidol') || nameLower.includes('marker') || nameLower.includes('snowman') || nameLower.includes('lakban') || nameLower.includes('tape') || nameLower.includes('isolasi') || nameLower.includes('double tape') || nameLower.includes('binder clip') || nameLower.includes('gunting') || nameLower.includes('stapler') || nameLower.includes('hekter') || nameLower.includes('map') || nameLower.includes('stopmap')) {
      sub = 'Perlengkapan Kantor';
    } else if (nameLower.includes('tinta') || nameLower.includes('epson') || nameLower.includes('canon') || nameLower.includes('universal')) {
      sub = 'Tinta Printer';
    }
    return { kategori: 'ATK', subKategori: sub };
  }

  // 8. Makanan & Camilan
  const bumbuKeywords = ['bumbu', 'sambal', 'ajinomoto', 'masako', 'royco', 'garam', 'sasa', 'kecap', 'saos', 'saus', 'boncabe', 'bango', 'pedas'];
  if (bumbuKeywords.some(kw => nameLower.includes(kw))) {
    return { kategori: 'Makanan', subKategori: 'Bumbu & Bahan Makanan' };
  }

  if (currentCategory === 'Makanan' || nameLower.includes('roti') || nameLower.includes('biskuit') || nameLower.includes('camilan') || nameLower.includes('snack') || nameLower.includes('mie') || nameLower.includes('wafer') || nameLower.includes('permen') || nameLower.includes('coklat') || nameLower.includes('cokelat')) {
    let sub = 'Makanan Ringan';
    if (nameLower.includes('aoka') || nameLower.includes('bonita') || nameLower.includes('roti') || nameLower.includes('croissant')) {
      sub = 'Roti & Kue';
    } else if (nameLower.includes('manis') || nameLower.includes('coklat') || nameLower.includes('cokelat') || nameLower.includes('keju') || nameLower.includes('strawberry') || nameLower.includes('yupi') || nameLower.includes('candy') || nameLower.includes('permen') || nameLower.includes('superstar') || nameLower.includes('better') || nameLower.includes('astor') || nameLower.includes('nextar') || nameLower.includes('nabati') || nameLower.includes('oreo') || nameLower.includes('gery') || nameLower.includes('beng') || nameLower.includes('chocolatos') || nameLower.includes('silverqueen') || nameLower.includes('dilan') || nameLower.includes('wafello')) {
      sub = 'Makanan Manis';
    } else if (nameLower.includes('abon') || nameLower.includes('mie') || nameLower.includes('indomie') || nameLower.includes('pop mie') || nameLower.includes('sarimi')) {
      sub = 'Makanan Siap Saji';
    }
    return { kategori: 'Makanan', subKategori: sub };
  }

  // 9. Minuman
  if (currentCategory === 'Minuman' || nameLower.includes('air') || nameLower.includes('minum') || nameLower.includes('jus') || nameLower.includes('sari buah') || nameLower.includes('kopi') || nameLower.includes('susu') || nameLower.includes('teh') || nameLower.includes('soda') || nameLower.includes('saset') || nameLower.includes('serbuk')) {
    let sub = 'Lainnya';
    if (nameLower.includes('kopi') || nameLower.includes('coffee') || nameLower.includes('coffe') || nameLower.includes('caffino') || nameLower.includes('torabika') || nameLower.includes('good day') || nameLower.includes('nescafe') || nameLower.includes('kapten')) {
      sub = 'Kopi';
    } else if (nameLower.includes('susu') || nameLower.includes('milk') || nameLower.includes('ultra') || nameLower.includes('dancow') || nameLower.includes('frisian') || nameLower.includes('clevo') || nameLower.includes('pop ice') || nameLower.includes('indomilk')) {
      sub = 'Susu';
    } else if (nameLower.includes('mineral') || nameLower.includes('club') || nameLower.includes('aqua') || nameLower.includes('vit') || nameLower.includes('le minerale')) {
      sub = 'Air Mineral';
    } else if (nameLower.includes('teh') || nameLower.includes('pucuk') || nameLower.includes('sariwangi') || nameLower.includes('teh gelas') || nameLower.includes('teh botol') || nameLower.includes('teh kotak')) {
      sub = 'Teh';
    } else if (nameLower.includes('soda') || nameLower.includes('cola') || nameLower.includes('sprite') || nameLower.includes('fanta') || nameLower.includes('coke') || nameLower.includes('spark') || nameLower.includes('carbonated')) {
      sub = 'Soda';
    } else if (nameLower.includes('jus') || nameLower.includes('sari buah') || nameLower.includes('you c1000') || nameLower.includes('c1000') || nameLower.includes('fibe') || nameLower.includes('ale-ale') || nameLower.includes('ale ale') || nameLower.includes('jeruk') || nameLower.includes('lemon') || nameLower.includes('orange') || nameLower.includes('mangga')) {
      sub = 'Jus/Sari Buah';
    } else if (nameLower.includes('saset') || nameLower.includes('serbuk') || nameLower.includes('chocolatos') || nameLower.includes('energen')) {
      sub = 'Saset/Serbuk';
    }
    return { kategori: 'Minuman', subKategori: sub };
  }

  // 10. Fallback
  return { kategori: currentCategory || 'Lainnya', subKategori: currentCategory || 'Lainnya' };
}

async function migrateCollection(collectionName) {
  console.log(`\n======================================================`);
  console.log(`Processing collection: ${collectionName}`);
  console.log(`======================================================`);

  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      console.log(`Collection '${collectionName}' is empty or does not exist.`);
      return;
    }

    console.log(`Found ${snapshot.size} documents in '${collectionName}'`);

    let matchedCount = 0;
    let unchangedCount = 0;
    const updates = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const name = data.name || data.itemName || 'N/A';
      const curKat = data.kategori || data.category || '';
      const curSub = data.subKategori || data.subCategory || '';

      const { kategori, subKategori } = determineCategory(name, curKat);

      if (kategori !== curKat || subKategori !== curSub) {
        updates.push({
          id: docSnap.id,
          name,
          old: { kategori: curKat, subKategori: curSub },
          new: { kategori, subKategori }
        });
        matchedCount++;
      } else {
        unchangedCount++;
      }
    });

    console.log(`Unchanged: ${unchangedCount}`);
    console.log(`To be updated: ${matchedCount}`);

    // If dry run, write JSON report
    if (!EXECUTE) {
      const reportPath = path.join(__dirname, `migration_report_${collectionName}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(updates, null, 2));
      console.log(`Dry-run complete. Detailed changes report saved to: ${reportPath}`);
      console.log(`Note: NO database updates were made. Run with 'EXECUTE=true' to apply.`);
      return;
    }

    // Perform updates in batches of 500
    if (updates.length > 0) {
      console.log(`Applying updates to database in batches...`);
      let batch = writeBatch(db);
      let count = 0;

      for (const update of updates) {
        const docRef = doc(db, collectionName, update.id);
        batch.update(docRef, {
          kategori: update.new.kategori,
          subKategori: update.new.subKategori
        });
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          console.log(`Committed batch of 500 updates...`);
          batch = writeBatch(db);
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
        console.log(`Committed remaining ${count % 500} updates.`);
      }
      console.log(`✅ Successfully updated ${count} documents in '${collectionName}'!`);
    } else {
      console.log(`No updates needed for '${collectionName}'.`);
    }

  } catch (err) {
    console.error(`Error migrating collection '${collectionName}':`, err);
  }
}

async function run() {
  console.log(`Running migration script...`);
  console.log(`EXECUTE MODE: ${EXECUTE ? 'LIVE UPDATE (EXECUTE=true)' : 'DRY-RUN (Simulated)'}`);

  await migrateCollection('stocks');
  await migrateCollection('stocks_testing');

  console.log(`\nMigration run completed.`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
