const fs = require('fs');
const path = require('path');

/**
 * Updates majors.json by merging new majors from scraper with existing ones
 * Preserves existing majors and only adds new ones
 */
function updateMajorsData() {
  // Define paths that work both locally and in production
  const isProduction = process.env.NODE_ENV === 'production';
  const rootDir = isProduction ? process.cwd() : path.join(__dirname, '..', '..');
  
  const scraperOutputPath = path.join(rootDir, 'Scraper', 'penn_state_majors.json');
  const majorsJsonPath = path.join(rootDir, 'src', 'data', 'majors.json');

  console.log('🎓 Starting majors data update...');
  console.log(`📂 Scraper output: ${scraperOutputPath}`);
  console.log(`📂 Majors JSON: ${majorsJsonPath}`);

  // Step 1: Check if scraper output file exists
  if (!fs.existsSync(scraperOutputPath)) {
    console.error('❌ Scraper output file not found. Please run the major scraper first.');
    process.exit(1);
  }

  // Step 2: Read existing majors.json
  let existingMajors = [];
  if (fs.existsSync(majorsJsonPath)) {
    try {
      const existingData = fs.readFileSync(majorsJsonPath, 'utf8');
      existingMajors = JSON.parse(existingData);
      
      // Ensure it's an array
      if (!Array.isArray(existingMajors)) {
        console.warn('⚠️  Existing majors.json is not an array, starting fresh');
        existingMajors = [];
      }
      
      console.log(`📋 Found ${existingMajors.length} existing majors`);
    } catch (error) {
      console.warn('⚠️  Could not read existing majors.json, starting fresh');
      existingMajors = [];
    }
  } else {
    console.log('📋 No existing majors.json found, creating new file');
  }

  // Step 3: Read new majors from scraper output
  console.log('📖 Reading new majors from scraper output...');
  let newMajors = [];
  try {
    const newData = fs.readFileSync(scraperOutputPath, 'utf8');
    newMajors = JSON.parse(newData);
    
    if (!Array.isArray(newMajors)) {
      console.error('❌ Scraper output is not an array');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Could not read scraper output file:', error.message);
    process.exit(1);
  }

  // Step 4: Clean and validate new majors
  const cleanNewMajors = newMajors
    .filter(major => major && typeof major === 'string' && major.trim().length > 0)
    .map(major => major.trim());

  console.log(`📥 Found ${cleanNewMajors.length} majors from scraper`);

  // Step 5: Merge data (case-insensitive check to avoid duplicates)
  const existingLowerCase = existingMajors.map(major => major.toLowerCase());
  const newUniqueMajors = cleanNewMajors.filter(major => 
    !existingLowerCase.includes(major.toLowerCase())
  );

  const mergedMajors = [...existingMajors, ...newUniqueMajors].sort();

  console.log(`✨ Added ${newUniqueMajors.length} new majors`);
  console.log(`📊 Total majors: ${mergedMajors.length}`);

  // Step 6: Save updated data
  const outputDir = path.dirname(majorsJsonPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(majorsJsonPath, JSON.stringify(mergedMajors, null, 2));

  // Step 7: Create backup with timestamp
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupPath = path.join(outputDir, `majors-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(mergedMajors, null, 2));

  console.log('✅ majors.json updated successfully!');
  console.log(`💾 Backup created: ${backupPath}`);

  // Step 8: Log new majors added
  if (newUniqueMajors.length > 0) {
    console.log('\n🆕 New majors added:');
    newUniqueMajors.forEach(major => console.log(`   • ${major}`));
  } else {
    console.log('\n✨ No new majors to add');
  }

  return {
    existing: existingMajors.length,
    new: newUniqueMajors.length,
    total: mergedMajors.length
  };
}

// Run if called directly
if (require.main === module) {
  try {
    updateMajorsData();
  } catch (error) {
    console.error('❌ Error updating majors data:', error.message);
    process.exit(1);
  }
}

module.exports = updateMajorsData; 