import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Copying data files to backend directory...');

const sourceDir = path.join(__dirname, '..', '..', 'src', 'data');
const targetDir = path.join(__dirname, 'data');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`✅ Created directory: ${targetDir}`);
}

// Copy data files
const filesToCopy = ['hobbies.json', 'traits.json', 'clubs.json', 'majors.json'];

filesToCopy.forEach(filename => {
  const sourcePath = path.join(sourceDir, filename);
  const targetPath = path.join(targetDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Copied ${filename} to backend/data/`);
    } catch (error) {
      console.log(`❌ Failed to copy ${filename}: ${error.message}`);
    }
  } else {
    console.log(`⚠️ Source file not found: ${sourcePath}`);
  }
});

console.log('🎯 Data file copy complete!'); 