#!/usr/bin/env node

/**
 * Annual Data Update Script
 * Run this script every May to update both clubs and majors databases
 * 
 * Usage:
 *   node scripts/annual-data-update.js
 *   npm run update-data
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎓 NSBE PSU Annual Data Update Script');
console.log('====================================');

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1; // 1-12
const currentYear = currentDate.getFullYear();

console.log(`📅 Current date: ${currentDate.toDateString()}`);

// Remind about May updates
if (currentMonth === 5) {
  console.log('🌸 Perfect timing! It\'s May - ideal time for annual updates!');
} else if (currentMonth < 5) {
  console.log(`⏰ Note: Annual updates are typically done in May (${5 - currentMonth} months away)`);
} else {
  console.log(`⏰ Note: You might want to wait until next May for the annual update`);
}

console.log('\n📋 Update Process:');
console.log('1. Run web scrapers to get latest organizations and majors');
console.log('2. Merge new data with existing clubs.json and majors.json');
console.log('3. Create backups of previous data');

// Check if we're in the right directory
const rootDir = process.cwd();
const expectedFiles = ['package.json', 'src', 'Scraper'];
const missingFiles = expectedFiles.filter(file => !fs.existsSync(path.join(rootDir, file)));

if (missingFiles.length > 0) {
  console.error(`❌ Please run this script from the project root directory`);
  console.error(`Missing: ${missingFiles.join(', ')}`);
  process.exit(1);
}

async function runUpdate() {
  try {
    console.log('\n🕷️  Step 1: Running web scrapers...');
    console.log('   (This may take a few minutes)');
    
    // Run the clubs scraper
    console.log('\n📚 Scraping organizations...');
    const clubsScraperPath = path.join(rootDir, 'Scraper', 'scraper.py');
    execSync(`python3 ${clubsScraperPath}`, { 
      stdio: 'inherit',
      cwd: path.join(rootDir, 'Scraper')
    });

    // Run the majors scraper
    console.log('\n🎓 Scraping majors...');
    const majorsScraperPath = path.join(rootDir, 'Scraper', 'majorScraper.py');
    execSync(`python3 ${majorsScraperPath}`, { 
      stdio: 'inherit',
      cwd: path.join(rootDir, 'Scraper')
    });

    console.log('\n🔄 Step 2: Merging new data...');
    
    // Update clubs
    console.log('\n📚 Updating clubs database...');
    const updateClubsScript = path.join(rootDir, 'src', 'utils', 'mergeClubs.cjs');
    const clubsResult = require(updateClubsScript)();

    // Update majors  
    console.log('\n🎓 Updating majors database...');
    const updateMajorsScript = path.join(rootDir, 'src', 'utils', 'updateMajors.cjs');
    const majorsResult = require(updateMajorsScript)();

    console.log('\n📊 Update Summary:');
    console.log('📚 Organizations:');
    console.log(`   • Previous: ${clubsResult.existing}`);
    console.log(`   • New: ${clubsResult.new}`);
    console.log(`   • Total: ${clubsResult.total}`);
    console.log('🎓 Majors:');
    console.log(`   • Previous: ${majorsResult.existing}`);
    console.log(`   • New: ${majorsResult.new}`);
    console.log(`   • Total: ${majorsResult.total}`);

    console.log('\n✅ Annual data update completed successfully!');
    console.log(`📝 Next update recommended: May ${currentYear + 1}`);

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    
    if (error.message.includes('python3')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   • Make sure Python 3 is installed');
      console.log('   • Install required packages: pip install selenium openpyxl');
      console.log('   • Make sure Chrome/Chromium is installed');
    }
    
    process.exit(1);
  }
}

// Confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\n🤔 Do you want to proceed with the annual data update (clubs + majors)? (y/N): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    rl.close();
    runUpdate();
  } else {
    console.log('❌ Update cancelled');
    rl.close();
  }
}); 