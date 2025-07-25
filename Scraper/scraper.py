import json
import time
import os
import tempfile
import uuid
import shutil
import random
import glob
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager

def cleanup_browser_processes():
    """Kill any existing browser processes that might be interfering."""
    try:
        import subprocess
        # Kill any existing browser processes
        for process_name in ['chrome', 'chromium', 'chromium-browser', 'firefox', 'geckodriver']:
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
            '/dev/shm/chrome_*',
            '/tmp/firefox_*',
            '/tmp/rust_mozprofile*'
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
        
        print("🧹 Cleaned up any existing browser processes and lock files")
    except:
        pass

def try_requests_approach():
    """Try to scrape using requests library without browser automation."""
    print("🌐 Attempting requests-based approach (no browser)...")
    
    try:
        # Try to get the page with requests
        url = 'https://discover.psu.edu/organizations'
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        print(f"📡 Making request to: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            print(f"✅ Got response ({len(response.text)} chars)")
            
            # Look for organization links in the HTML
            import re
            
            # Try to find organization links
            org_links = re.findall(r'href="[^"]*?/organization/([^"]*?)"', response.text)
            
            if org_links:
                print(f"🎯 Found {len(org_links)} organization links in static HTML")
                
                organizations = []
                for i, org_slug in enumerate(set(org_links)):  # Remove duplicates
                    if org_slug:
                        # Convert slug to readable name
                        name = org_slug.replace('-', ' ').title()
                        organizations.append({
                            'name': clean_organization_name(name),
                            'acronyms': []
                        })
                        
                        if (i + 1) % 50 == 0:
                            print(f"📊 Processed {i + 1} organizations...")
                
                print(f"✅ Extracted {len(organizations)} organizations using requests approach")
                return organizations
            else:
                print("❌ No organization links found in static HTML - site likely uses JavaScript")
                return None
        else:
            print(f"❌ HTTP {response.status_code} - {response.reason}")
            return None
            
    except Exception as e:
        print(f"❌ Requests approach failed: {e}")
        return None

def setup_firefox_driver():
    """Set up Firefox WebDriver as an alternative to Chrome."""
    print("🦊 Attempting Firefox WebDriver setup...")
    
    try:
        firefox_options = FirefoxOptions()
        firefox_options.add_argument('--headless')
        firefox_options.add_argument('--no-sandbox')
        firefox_options.add_argument('--disable-dev-shm-usage')
        firefox_options.add_argument('--disable-gpu')
        firefox_options.add_argument('--window-size=1920,1080')
        
        # Detect if running in CI environment
        is_ci = os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS')
        
        if is_ci:
            print("🤖 CI mode - using system Firefox")
            # In CI, try to use system Firefox/Geckodriver
            
            # Try to find Firefox binary
            firefox_paths = [
                '/usr/bin/firefox',
                '/usr/bin/firefox-esr',
                '/snap/bin/firefox',
                '/opt/firefox/firefox'
            ]
            
            firefox_binary = None
            for path in firefox_paths:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    firefox_binary = path
                    print(f"🔍 Found Firefox binary: {firefox_binary}")
                    break
            
            if firefox_binary:
                firefox_options.binary_location = firefox_binary
            
            # Create a unique temp profile
            profile_dir = f"/tmp/firefox_profile_{os.getpid()}_{int(time.time())}"
            firefox_options.add_argument(f'--profile={profile_dir}')
            
            driver = webdriver.Firefox(options=firefox_options)
        else:
            print("💻 Local mode - using webdriver-manager for Firefox")
            service = FirefoxService(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=firefox_options)
        
        print("✅ Firefox WebDriver initialized successfully")
        return driver
        
    except Exception as e:
        print(f"❌ Firefox setup failed: {e}")
        return None

def setup_driver():
    """Set up WebDriver with multiple fallback strategies."""
    # Detect if running in CI environment
    is_ci = os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS')
    
    if is_ci:
        print("🤖 Running in CI mode - trying multiple browser strategies")
        
        # Clean up any existing processes first
        cleanup_browser_processes()
        time.sleep(2)
        
        # Strategy 1: Try requests-based approach (no browser needed)
        print("\n🔄 Strategy 1: Requests-based scraping")
        organizations = try_requests_approach()
        if organizations:
            return "requests_success", organizations
        
        # Strategy 2: Try Firefox
        print("\n🔄 Strategy 2: Firefox WebDriver")
        driver = setup_firefox_driver()
        if driver:
            return driver, None
        
        # Strategy 3: Try Chrome with ultra-minimal config
        print("\n🔄 Strategy 3: Ultra-minimal Chrome")
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--single-process')
            chrome_options.add_argument('--no-zygote')
            chrome_options.add_argument('--window-size=1920,1080')
            
            # Try different Chrome binaries
            chrome_paths = ['/snap/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
            for chrome_binary in chrome_paths:
                if os.path.exists(chrome_binary):
                    chrome_options.binary_location = chrome_binary
                    print(f"🔍 Trying Chrome binary: {chrome_binary}")
                    break
            
            driver = webdriver.Chrome(options=chrome_options)
            print("✅ Ultra-minimal Chrome successful")
            return driver, None
            
        except Exception as e:
            print(f"❌ Ultra-minimal Chrome failed: {e}")
        
        print("❌ All CI strategies failed")
        return None, None
    
    else:
        # Local development - try Chrome first, then Firefox
        print("💻 Running in local mode")
        
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            service = ChromeService(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            print("✅ Local Chrome WebDriver initialized successfully")
            return driver, None
        except Exception as e:
            print(f"❌ Local Chrome failed: {e}, trying Firefox...")
            driver = setup_firefox_driver()
            if driver:
                return driver, None
            else:
                print(f"❌ Both Chrome and Firefox failed in local mode")
                return None, None

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
    Scrape Penn State organizations using multiple fallback strategies.
    """
    url = 'https://discover.psu.edu/organizations'
    
    result = setup_driver()
    if not result or result[0] is None:
        print("❌ Could not initialize any web driver or scraping method")
        return []
    
    driver, organizations = result
    
    # If we got organizations from requests approach, return them
    if driver == "requests_success" and organizations:
        print(f"✅ Successfully scraped {len(organizations)} organizations using requests approach")
        return organizations
    
    # Otherwise, use Selenium with the initialized driver
    organizations = []
    
    try:
        print(f"🌐 Loading page with Selenium: {url}")
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
        max_clicks = 100  # Reduced for faster testing
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
        if driver and driver != "requests_success":
            driver.quit()
            print("🔒 Browser closed")
            
            # Cleanup temporary directories
            cleanup_browser_processes()

    return organizations

def main():
    print("🏫 Penn State Organizations Scraper")
    print("=" * 50)
    print("📋 Target: 1212+ organizations")
    print("🔄 Multi-strategy approach: Requests → Firefox → Chrome")
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
        print("💡 All scraping strategies failed:")
        print("   1. Requests-based scraping (no browser)")
        print("   2. Firefox WebDriver")
        print("   3. Chrome WebDriver")
        print("💡 Possible issues:")
        print("   - Website requires complex JavaScript interactions")
        print("   - Network connectivity issues")
        print("   - CI environment restrictions")
        print("   - Website blocking automated access")

if __name__ == "__main__":
    main()