const fs = require('fs');
const XLSX = require('xlsx');

// ✅ Use a different variable name to avoid conflict
const excelPath = '/Users/msalau/NSBE-MENTOR-PROJECT/Scraper/clubs.xlsx';

// Step 1: Read Excel file
const workbook = XLSX.readFile(excelPath);

// Step 2: Get first sheet and extract rows
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

// Step 3: Extract just the club names (assumes column is 'Organization_Name')
const clubNames = data.map((row) => row.Organization_Name);

// Step 4: Save to JSON
fs.writeFileSync('/Users/msalau/NSBE-MENTOR-PROJECT/src/data/clubs.json', JSON.stringify(clubNames, null, 2));

console.log('✅ clubs.json created successfully!');
