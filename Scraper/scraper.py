import json
import time
import os
import tempfile
import uuid
import shutil
import random
import glob
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

def cleanup_chrome_processes():
    """Kill any existing Chrome processes that might be interfering."""
    try:
        import subprocess
        # Kill any existing Chrome/Chromium processes
        for process_name in ['chrome', 'chromium', 'chromium-browser']:
            try:
                subprocess.run(['pkill', '-f', process_name], 
                             capture_output=True, timeout=10)
            except:
                pass
        
        # Also try to clean up any lock files
        lock_patterns = [
            '/tmp/.com.google.Chrome.*',
            '/tmp/.org.chromium.Chromium.*',
            '/tmp/chrome_*',
            '/dev/shm/chrome_*'
        ]
        
        for pattern in lock_patterns:
            for lock_file in glob.glob(pattern):
                try:
                    if os.path.isfile(lock_file):
                        os.remove(lock_file)
                    elif os.path.isdir(lock_file):
                        shutil.rmtree(lock_file)
                except:
                    pass
        
        print("🧹 Cleaned up any existing Chrome processes and lock files")
    except:
        pass

def setup_driver():
    """Set up Chrome WebDriver with appropriate options."""
    # Detect if running in CI environment
    is_ci = os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS')
    
    if is_ci:
        print("🤖 Running in CI mode - using minimal Chrome configuration")
        
        # Clean up any existing Chrome processes first
        cleanup_chrome_processes()
        
        # Wait a moment for cleanup to complete
        time.sleep(2)
        
        # Find Chrome binary
        chrome_paths = [
            '/snap/bin/chromium',
            '/usr/bin/chromium-browser',
            '/opt/google/chrome/google-chrome',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
        ]
        
        chrome_binary = None
        for path in chrome_paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                chrome_binary = path
                print(f"🔍 Found Chrome binary: {chrome_binary}")
                break
        
        # Try multiple approaches in order of preference
        approaches = [
            {
                'name': 'Remote debugging approach',
                'method': 'remote_debug'
            },
            {
                'name': 'Force new session with cleanup',
                'method': 'force_new'
            },
            {
                'name': 'Minimal Chromium snap',
                'method': 'snap_minimal'
            },
            {
                'name': 'Emergency fallback',
                'method': 'emergency'
            }
        ]
        
        for i, approach in enumerate(approaches, 1):
            try:
                print(f"🔄 Attempt {i}: {approach['name']}")
                
                chrome_options = Options()
                
                if approach['method'] == 'remote_debug':
                    # Use remote debugging approach - no user data dir needed
                    chrome_options.add_argument('--headless=new')
                    chrome_options.add_argument('--no-sandbox')
                    chrome_options.add_argument('--disable-dev-shm-usage')
                    chrome_options.add_argument('--disable-gpu')
                    chrome_options.add_argument('--remote-debugging-port=0')  # Let Chrome pick a port
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--disable-default-apps')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--disable-plugins')
                    chrome_options.add_argument('--disable-sync')
                    chrome_options.add_argument('--disable-translate')
                    chrome_options.add_argument('--disable-background-networking')
                    chrome_options.add_argument('--window-size=1920,1080')
                    chrome_options.add_argument('--virtual-time-budget=25000')
                    # Explicitly avoid user data directory
                    chrome_options.add_argument('--disable-background-mode')
                    chrome_options.add_argument('--disable-restore-session-state')
                    chrome_options.add_argument('--disable-session-crashed-bubble')
                    
                elif approach['method'] == 'force_new':
                    # Force a completely new session
                    chrome_options.add_argument('--headless=new')
                    chrome_options.add_argument('--no-sandbox')
                    chrome_options.add_argument('--disable-dev-shm-usage')
                    chrome_options.add_argument('--disable-gpu')
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--disable-default-apps')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--disable-sync')
                    chrome_options.add_argument('--window-size=1920,1080')
                    chrome_options.add_argument('--force-first-run')
                    chrome_options.add_argument('--no-default-browser-check')
                    chrome_options.add_argument('--disable-background-mode')
                    chrome_options.add_argument('--disable-restore-session-state')
                    chrome_options.add_argument('--disable-session-crashed-bubble')
                    chrome_options.add_argument('--disable-features=TranslateUI,BlinkGenPropertyTrees')
                    
                    # Create a truly unique temp directory
                    random_id = f"{int(time.time())}_{os.getpid()}_{random.randint(10000, 99999)}"
                    temp_dir = f"/tmp/chrome_force_{random_id}"
                    
                    # Ensure directory doesn't exist
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir)
                    
                    os.makedirs(temp_dir, mode=0o755)
                    chrome_options.add_argument(f'--user-data-dir={temp_dir}')
                    print(f"🗂️ Force new session with: {temp_dir}")
                    
                elif approach['method'] == 'snap_minimal':
                    # Try minimal approach specifically for snap chromium
                    chrome_options.add_argument('--headless')
                    chrome_options.add_argument('--no-sandbox')
                    chrome_options.add_argument('--disable-dev-shm-usage')
                    chrome_options.add_argument('--disable-gpu')
                    chrome_options.add_argument('--disable-software-rasterizer')
                    chrome_options.add_argument('--disable-features=VizDisplayCompositor')
                    chrome_options.add_argument('--window-size=1920,1080')
                    chrome_options.add_argument('--single-process')
                    
                elif approach['method'] == 'emergency':
                    # Emergency minimal settings
                    chrome_options.add_argument('--headless')
                    chrome_options.add_argument('--no-sandbox')
                    chrome_options.add_argument('--window-size=1920,1080')
                
                # Set Chrome binary if found
                if chrome_binary:
                    chrome_options.binary_location = chrome_binary
                
                # Set user agent
                chrome_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
                
                # Try to create the driver
                driver = webdriver.Chrome(options=chrome_options)
                print(f"✅ Chrome WebDriver initialized successfully with approach {i}")
                
                # Store temp directory for cleanup if it was created
                if approach['method'] == 'force_new' and 'temp_dir' in locals():
                    setup_driver.temp_dir = temp_dir
                
                return driver
                
            except Exception as e:
                print(f"❌ Attempt {i} failed: {e}")
                
                # Cleanup temp directory if it was created
                if approach['method'] == 'force_new' and 'temp_dir' in locals() and os.path.exists(temp_dir):
                    try:
                        shutil.rmtree(temp_dir)
                    except:
                        pass
                
                # Wait between attempts
                time.sleep(1)
                continue
        
        print("❌ All approaches failed")
        return None
    
    else:
        # Local development
        print("💻 Running in local mode")
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            print("✅ Chrome WebDriver initialized successfully")
            return driver
        except Exception as e:
            print(f"❌ Error in local mode: {e}")
            return None

def clean_organization_name(name):
    """Clean organization name by removing common suffixes."""
    if not name:
        return None
    
    # Remove common suffixes
    suffixes_to_remove = [
        " at University Park",
        " at Penn State",
        " - University Park",
        " (University Park)"
    ]
    
    cleaned_name = name
    for suffix in suffixes_to_remove:
        if cleaned_name.endswith(suffix):
            cleaned_name = cleaned_name[:-len(suffix)]
    
    return cleaned_name.strip()

def scrape_psu_organizations():
    """
    Scrape Penn State organizations by clicking 'Load More' until all are loaded.
    """
    
    url = 'https://discover.psu.edu/organizations'
    
    driver = setup_driver()
    if not driver:
        print("❌ Could not initialize web driver")
        return []
    
    organizations = []
    
    try:
        print(f"🌐 Loading page: {url}")
        driver.get(url)
        
        # Wait for the page to load
        print("⏳ Waiting for page to load...")
        time.sleep(5)
        
        # Wait for initial organizations to load
        try:
            wait = WebDriverWait(driver, 20)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/organization/']")))
            print("✅ Initial organizations loaded")
        except TimeoutException:
            print("⚠️  Timeout waiting for organizations, checking what's on the page...")
            
            # Check if page loaded at all
            page_title = driver.title
            print(f"📄 Page title: {page_title}")
            
            # Look for any organization-related elements
            alternative_selectors = [
                "a[href*='/organization/']",
                ".MuiCard-root",
                ".MuiPaper-root"
            ]
            
            found_selector = None
            for selector in alternative_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"✅ Found {len(elements)} elements with selector: {selector}")
                    found_selector = selector
                    break
            
            if not found_selector:
                print("❌ Could not find organization elements")
                return []
        
        # Click "Load More" button repeatedly until all organizations are loaded
        click_count = 0
        max_clicks = 150
        consecutive_no_change = 0
        
        while click_count < max_clicks:
            # Count current organizations
            org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
            current_count = len(org_elements)
            
            print(f"📊 Currently loaded: {current_count} organizations")
            
            # Look for "Load More" button
            load_more_selectors = [
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')]",
                "//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')]/ancestor::button",
                ".outlinedButton button",
                "button[style*='text-transform: uppercase']",
                "//button[contains(@class, 'MuiButton') and contains(., 'LOAD MORE')]",
                "//button[contains(@class, 'MuiButton')]//span[contains(text(), 'LOAD MORE')]/ancestor::button"
            ]
            
            load_more_button = None
            for selector in load_more_selectors:
                try:
                    if selector.startswith('//'):
                        button = driver.find_element(By.XPATH, selector)
                    else:
                        button = driver.find_element(By.CSS_SELECTOR, selector)
                    
                    if button.is_displayed() and button.is_enabled():
                        load_more_button = button
                        print(f"✅ Found load more button with selector: {selector}")
                        break
                except:
                    continue
            
            if load_more_button:
                try:
                    # Scroll to the button and wait
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", load_more_button)
                    time.sleep(2)
                    
                    # Try clicking with JavaScript if regular click fails
                    try:
                        load_more_button.click()
                    except:
                        driver.execute_script("arguments[0].click();", load_more_button)
                    
                    click_count += 1
                    print(f"🔄 Clicked 'Load More' button #{click_count}")
                    
                    # Wait for new content to load
                    time.sleep(3)
                    
                    # Wait for network activity to settle
                    wait_count = 0
                    while wait_count < 10:
                        time.sleep(1)
                        new_org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
                        new_count = len(new_org_elements)
                        
                        if new_count > current_count:
                            print(f"📈 New organizations loaded: {new_count - current_count}")
                            consecutive_no_change = 0
                            break
                        wait_count += 1
                    
                    # Final count check
                    final_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
                    final_count = len(final_elements)
                    
                    if final_count >= 1212:
                        print(f"🎯 Target reached! Found {final_count} organizations")
                        break
                    
                    if final_count == current_count:
                        consecutive_no_change += 1
                        print(f"⚠️  No new organizations loaded (attempt {consecutive_no_change})")
                        
                        if consecutive_no_change >= 3:
                            print(f"✅ No more organizations to load after {consecutive_no_change} attempts. Final count: {final_count}")
                            break
                        
                        time.sleep(5)
                    
                except Exception as e:
                    print(f"⚠️  Error clicking load more button: {e}")
                    consecutive_no_change += 1
                    if consecutive_no_change >= 3:
                        break
            else:
                print("🏁 No 'Load More' button found - all organizations loaded")
                break
        
        # Extract organization data
        print("📝 Extracting organization information...")
        
        # Get final count of organizations
        org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
        
        if not org_elements:
            print("❌ No organization elements found")
            return []
        
        print(f"✅ Found {len(org_elements)} organization links to process")
        
        for i, element in enumerate(org_elements):
            try:
                org_data = {}
                
                # Extract organization name
                name_selectors = [
                    "div[style*='font-weight: 600'][style*='color: rgb(73, 73, 73)']",
                    "div[style*='font-weight: 600']",
                    "div[style*='1.125rem']",
                    ".MuiTypography-h6",
                    "h6",
                ]
                
                name = None
                for name_selector in name_selectors:
                    try:
                        name_elem = element.find_element(By.CSS_SELECTOR, name_selector)
                        potential_name = name_elem.text.strip()
                        
                        if potential_name and len(potential_name) < 200 and '\n' not in potential_name:
                            name = clean_organization_name(potential_name)
                            if name:
                                break
                    except:
                        continue
                
                # Fallback: extract from href and clean it
                if not name:
                    href = element.get_attribute('href')
                    if href and '/organization/' in href:
                        url_name = href.split('/organization/')[-1]
                        name = url_name.replace('-', ' ').title() if url_name else None
                
                if name:
                    org_data['name'] = name
                    org_data['acronyms'] = []
                    organizations.append(org_data)
                
                # Progress indicator
                if (i + 1) % 50 == 0:
                    print(f"📊 Processed {i + 1}/{len(org_elements)} organizations...")
                    
            except Exception as e:
                print(f"⚠️  Error extracting data from organization {i + 1}: {e}")
                continue
        
        print(f"✅ Extracted data from {len(organizations)} organizations")
    
    except WebDriverException as e:
        print(f"❌ WebDriver error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        driver.quit()
        print("🔒 Browser closed")
        
        # Cleanup temporary directories
        if hasattr(setup_driver, 'temp_dir') and setup_driver.temp_dir:
            try:
                if os.path.exists(setup_driver.temp_dir):
                    shutil.rmtree(setup_driver.temp_dir)
                    print(f"🧹 Cleaned up temp directory: {setup_driver.temp_dir}")
            except Exception as cleanup_error:
                print(f"⚠️ Could not cleanup temp directory: {cleanup_error}")

def main():
    print("🏫 Penn State Organizations Scraper")
    print("=" * 50)
    print("📋 Target: 1212+ organizations")
    print("🔄 Will click 'Load More' until all are loaded")
    print("✂️  Organization names will be cleaned")
    print("=" * 50)
    
    organizations = scrape_psu_organizations()
    
    if organizations:
        # Save to JSON file
        with open('psu_organizations.json', 'w') as f:
            json.dump(organizations, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Successfully saved {len(organizations)} organizations to psu_organizations.json")
        
        # Display sample organizations
        print(f"\n📋 Sample organizations (with cleaned names):")
        for i, org in enumerate(organizations[:10]):
            print(f"{i+1:2d}. {org.get('name', 'Unknown')}")
            print(f"    Acronyms: {org.get('acronyms', [])}")
            print()
        
        if len(organizations) > 10:
            print(f"... and {len(organizations) - 10} more")
        
        # Statistics
        print(f"\n📊 Statistics:")
        print(f"   Total organizations: {len(organizations)}")
        print(f"   All organizations have empty acronyms arrays")
        
    else:
        print("\n❌ No organizations were found.")
        print("💡 Troubleshooting steps:")
        print("   1. Make sure ChromeDriver is installed")
        print("   2. Check if the website structure has changed")
        print("   3. Try running with visible browser (comment out --headless)")
        print("   4. Check your internet connection")
        print("   5. Try increasing wait times if the site is slow")

if __name__ == "__main__":
    main()