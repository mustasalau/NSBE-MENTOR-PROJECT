# 🎓 Annual Data Update Guide

This guide explains how to update both the clubs and majors databases every May to capture new student organizations and academic programs while preserving existing ones.

## 📅 When to Run

- **Recommended**: Every May
- **Why May**: New organizations typically register for the following academic year

## 🚀 Quick Start

### Method 1: Full Automated Update (Recommended)
```bash
npm run update-data
```

### Method 2: Individual Updates
```bash
# Clubs only
npm run update-clubs

# Majors only  
npm run update-majors-only

# Manual steps
cd Scraper
python3 scraper.py      # Organizations
python3 majorScraper.py # Majors
npm run update-clubs-only
npm run update-majors-only
```

## 📋 What It Does

1. **🕷️ Web Scraping**: Scrapes PSU's OrgCentral and academic bulletins for current data
2. **🔄 Smart Merging**: Adds new organizations and majors while preserving existing ones
3. **💾 Backup Creation**: Creates timestamped backups before updating
4. **📊 Reporting**: Shows what was added and summary statistics for both datasets

## 🏗️ System Architecture

```
Scraper/scraper.py → clubs.xlsx → updateClubs.cjs → src/data/clubs.json
Scraper/majorScraper.py → penn_state_majors.json → updateMajors.cjs → src/data/majors.json
```

### File Structure
```
NSBE-MENTOR-PROJECT/
├── Scraper/
│   ├── scraper.py          # Web scraper for PSU organizations
│   ├── majorScraper.py     # Web scraper for PSU majors
│   ├── clubs.xlsx          # Raw clubs data (generated)
│   └── penn_state_majors.json # Raw majors data (generated)
├── src/
│   ├── data/
│   │   ├── clubs.json      # Final clubs database
│   │   ├── majors.json     # Final majors database
│   │   ├── clubs-backup-*.json  # Timestamped backups
│   │   └── majors-backup-*.json # Timestamped backups
│   └── utils/
│       ├── updateClubs.cjs # Clubs merge logic
│       └── updateMajors.cjs # Majors merge logic
└── scripts/
    ├── annual-data-update.js    # Main update script (both)
    └── annual-clubs-update.js   # Clubs only script
```

## 🔧 Prerequisites

### Local Development
```bash
# Python dependencies
pip install selenium openpyxl

# Node.js dependencies (already installed)
npm install
```

### Production/Hosting
- Ensure Python 3 is available in the hosting environment
- Chrome/Chromium browser for Selenium
- Write permissions to `src/data/` directory

## 📊 Data Format

The databases use these formats:

**Clubs:**
```json
[
  {
    "name": "Organization Name",
    "acronyms": ["ORG", "ABBREV"]
  }
]
```

**Majors:**
```json
[
  "Accounting, B.S.",
  "Computer Science, B.S.",
  "Engineering, B.S."
]
```

## 🚨 Troubleshooting

### Common Issues

**"Excel file not found"**
```bash
# Make sure scraper ran successfully
cd Scraper
python3 scraper.py
```

**"Python3 not found"**
```bash
# Install Python 3
# macOS: brew install python
# Ubuntu: apt install python3
# Windows: Download from python.org
```

**"Selenium errors"**
```bash
# Install Chrome browser
# Update selenium
pip install --upgrade selenium
```

**"Permission denied"**
```bash
# Check file permissions
chmod +x scripts/annual-clubs-update.js
```

## 🔒 Safety Features

- **Non-destructive**: Never overwrites existing organizations
- **Case-insensitive**: Prevents duplicate entries with different capitalization
- **Automatic backups**: Creates timestamped backups before any changes
- **Validation**: Checks data integrity before updating

## 📈 Production Deployment

### Automated Scheduling
You can set up automated annual updates using:

**GitHub Actions** (recommended for hosted apps):
```yaml
name: Annual Clubs Update
on:
  schedule:
    - cron: '0 0 1 5 *'  # May 1st every year
jobs:
  update-clubs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v3
        with:
          python-version: '3.x'
      - name: Install dependencies
        run: |
          pip install selenium openpyxl
          npm install
      - name: Update clubs
        run: npm run update-clubs-only
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/data/clubs.json
          git commit -m "🎓 Annual clubs update - $(date +'%Y-%m-%d')" || exit 0
          git push
```

**Cron Job** (for VPS/dedicated servers):
```bash
# Add to crontab (crontab -e)
0 0 1 5 * cd /path/to/project && npm run update-clubs-only
```

### Manual Production Update
1. SSH into your server
2. Navigate to project directory
3. Run `npm run update-clubs`
4. Commit and deploy changes

## 📝 Maintenance Notes

- **Performance**: Scraping takes 2-5 minutes depending on organization count
- **Rate Limiting**: Built-in delays prevent overwhelming PSU servers
- **Browser Requirements**: Requires Chrome/Chromium for Selenium
- **Data Growth**: Expect ~50-100 new organizations annually

## 🆘 Support

If you encounter issues:
1. Check this documentation
2. Verify all prerequisites are installed
3. Try running components individually
4. Check browser/driver compatibility
5. Review PSU OrgCentral website for structural changes

## 📅 Update Log Template

Keep track of updates:
```
## May 2024 Update
- Previous orgs: 450
- New orgs: 67
- Total orgs: 517
- Notable additions: [List significant new organizations]
- Issues: None
``` 