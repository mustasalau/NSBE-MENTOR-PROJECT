const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

/**
 * Updates clubs.json by merging new organizations from XLSX with existing ones
 * Preserves existing orgs and only adds new ones
 */
function updateClubsData() {
  // Define paths that work both locally and in production
  const isProduction = process.env.NODE_ENV === 'production';
  const rootDir = isProduction ? process.cwd() : path.join(__dirname, '..', '..');
  
  const excelPath = path.join(rootDir, 'Scraper', 'clubs.xlsx');
  const clubsJsonPath = path.join(rootDir, 'src', 'data', 'clubs.json');

  console.log('🔄 Starting clubs data update...');
  console.log(`📂 Excel path: ${excelPath}`);
  console.log(`📂 JSON path: ${clubsJsonPath}`);

  // Step 1: Check if Excel file exists
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Excel file not found. Please run the scraper first.');
    process.exit(1);
  }

  // Step 2: Read existing clubs.json
  let existingClubs = [];
  if (fs.existsSync(clubsJsonPath)) {
    try {
      const existingData = fs.readFileSync(clubsJsonPath, 'utf8');
      const existingRaw = JSON.parse(existingData);
      
      // Handle both formats: array of strings or array of objects with name property
      if (Array.isArray(existingRaw)) {
        existingClubs = existingRaw.map(club => 
          typeof club === 'string' ? { name: club, acronyms: [] } : club
        );
      } else {
        existingClubs = [];
      }
      
      console.log(`📋 Found ${existingClubs.length} existing organizations`);
    } catch (error) {
      console.warn('⚠️  Could not read existing clubs.json, starting fresh');
      existingClubs = [];
    }
  } else {
    console.log('📋 No existing clubs.json found, creating new file');
  }

  // Step 3: Read new data from Excel
  console.log('📖 Reading new data from Excel...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  // Step 4: Extract club names (handle different possible column names)
  const possibleColumns = ['Organization Name', 'Organization_Name', 'Name', 'Club Name'];
  let columnName = null;
  
  for (const col of possibleColumns) {
    if (data.length > 0 && data[0][col]) {
      columnName = col;
      break;
    }
  }

  if (!columnName) {
    console.error('❌ Could not find organization name column in Excel file');
    console.log('Available columns:', Object.keys(data[0] || {}));
    process.exit(1);
  }

  const newClubNames = data
    .map(row => row[columnName])
    .filter(name => name && typeof name === 'string' && name.trim().length > 0)
    .map(name => name.trim());

  console.log(`📥 Found ${newClubNames.length} organizations in Excel file`);

  // Step 5: Merge data (case-insensitive check to avoid duplicates)
  const existingNames = existingClubs.map(club => club.name.toLowerCase());
  const newUniqueClubNames = newClubNames.filter(clubName => 
    !existingNames.includes(clubName.toLowerCase())
  );

  // Convert new club names to the expected format
  const newUniqueClubs = newUniqueClubNames.map(name => ({
    name: name,
    acronyms: []
  }));

  const mergedClubs = [...existingClubs, ...newUniqueClubs].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  console.log(`✨ Added ${newUniqueClubs.length} new organizations`);
  console.log(`📊 Total organizations: ${mergedClubs.length}`);

  // Step 6: Save updated data
  const outputDir = path.dirname(clubsJsonPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(clubsJsonPath, JSON.stringify(mergedClubs, null, 2));

  // Step 7: Create backup with timestamp
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupPath = path.join(outputDir, `clubs-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(mergedClubs, null, 2));

  console.log('✅ clubs.json updated successfully!');
  console.log(`💾 Backup created: ${backupPath}`);

  // Step 8: Log new organizations added
  if (newUniqueClubs.length > 0) {
    console.log('\n🆕 New organizations added:');
    newUniqueClubs.forEach(club => console.log(`   • ${club.name}`));
  } else {
    console.log('\n✨ No new organizations to add');
  }

  return {
    existing: existingClubs.length,
    new: newUniqueClubs.length,
    total: mergedClubs.length
  };
}

// Run if called directly
if (require.main === module) {
  try {
    updateClubsData();
  } catch (error) {
    console.error('❌ Error updating clubs data:', error.message);
    process.exit(1);
  }
}

module.exports = updateClubsData; 