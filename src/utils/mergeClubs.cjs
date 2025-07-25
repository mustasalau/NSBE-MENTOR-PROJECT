#!/usr/bin/env node

/**
 * Clubs Data Merge Script
 * Merges Python scraper output (psu_organizations.json) with existing clubs.json
 * Preserves existing acronyms and manual additions
 */

const fs = require('fs');
const path = require('path');

// Determine if we're running in production (GitHub Actions) or locally
const isProduction = process.env.NODE_ENV === 'production';

// Set paths based on environment
const getDataPath = (filename) => {
  if (isProduction) {
    // In GitHub Actions, we're in project root
    return path.join(process.cwd(), 'src', 'data', filename);
  } else {
    // Local development - navigate from src/utils to src/data
    return path.join(__dirname, '..', 'data', filename);
  }
};

const getScraperOutputPath = (filename) => {
  if (isProduction) {
    // In GitHub Actions, scraper runs in Scraper/ directory
    return path.join(process.cwd(), 'Scraper', filename);
  } else {
    // Local development
    return path.join(process.cwd(), 'Scraper', filename);
  }
};

function createBackup(filePath) {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupPath = filePath.replace('.json', `_backup_${timestamp}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backup created: ${path.basename(backupPath)}`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not create backup: ${error.message}`);
  }
}

function mergeClubsData() {
  console.log('🔄 Starting clubs data merge...');
  
  const clubsJsonPath = getDataPath('clubs.json');
  const scraperOutputPath = getScraperOutputPath('psu_organizations.json');
  
  console.log(`📂 Looking for existing clubs: ${clubsJsonPath}`);
  console.log(`📂 Looking for scraper output: ${scraperOutputPath}`);
  
  // Check if scraper output exists
  if (!fs.existsSync(scraperOutputPath)) {
    throw new Error(`❌ Python scraper output not found: ${scraperOutputPath}`);
  }
  
  // Read scraper output
  console.log('📖 Reading Python scraper output...');
  const newOrgsData = JSON.parse(fs.readFileSync(scraperOutputPath, 'utf8'));
  console.log(`   Found ${newOrgsData.length} organizations from scraper`);
  
  // Read existing clubs data
  let existingClubs = [];
  if (fs.existsSync(clubsJsonPath)) {
    console.log('📖 Reading existing clubs.json...');
    existingClubs = JSON.parse(fs.readFileSync(clubsJsonPath, 'utf8'));
    console.log(`   Found ${existingClubs.length} existing organizations`);
    
    // Create backup
    createBackup(clubsJsonPath);
  } else {
    console.log('📝 No existing clubs.json found, creating new file');
  }
  
  // Create a map of existing clubs for efficient lookup (case-insensitive)
  const existingClubsMap = new Map();
  existingClubs.forEach(club => {
    if (club.name) {
      existingClubsMap.set(club.name.toLowerCase().trim(), club);
    }
  });
  
  console.log('🔍 Merging new organizations...');
  let newCount = 0;
  
  // Process new organizations
  newOrgsData.forEach(newOrg => {
    if (!newOrg.name) return;
    
    const normalizedName = newOrg.name.toLowerCase().trim();
    
    if (!existingClubsMap.has(normalizedName)) {
      // This is a new organization
      existingClubs.push({
        name: newOrg.name.trim(),
        acronyms: newOrg.acronyms || []
      });
      newCount++;
    }
    // If it exists, we keep the existing entry (preserving any manual acronyms)
  });
  
  // Sort by name for consistency
  existingClubs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  
  // Write updated data
  console.log('💾 Saving updated clubs.json...');
  fs.writeFileSync(clubsJsonPath, JSON.stringify(existingClubs, null, 2), 'utf8');
  
  const results = {
    existing: existingClubs.length - newCount,
    new: newCount,
    total: existingClubs.length
  };
  
  console.log('✅ Clubs merge completed!');
  console.log(`📊 Results:`);
  console.log(`   • Previous organizations: ${results.existing}`);
  console.log(`   • New organizations added: ${results.new}`);
  console.log(`   • Total organizations: ${results.total}`);
  
  return results;
}

// Export for use by other scripts
module.exports = mergeClubsData;

// Run if called directly
if (require.main === module) {
  try {
    mergeClubsData();
  } catch (error) {
    console.error('❌ Merge failed:', error.message);
    process.exit(1);
  }
} 