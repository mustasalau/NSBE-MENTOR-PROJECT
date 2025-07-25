import json
import time
import os
import tempfile
import uuid
import shutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    """Set up Chrome WebDriver with appropriate options."""
    chrome_options = Options()
    
    # Detect if running in CI environment
    import os
    is_ci = os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS')
    
    # Set correct Chrome binary path for GitHub Actions
    if is_ci:
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
                print(f"🔍 Found working Chrome/Chromium binary at: {chrome_binary}")
                break
        
        if chrome_binary:
            chrome_options.binary_location = chrome_binary
            print(f"✅ Using Chrome/Chromium binary: {chrome_binary}")
        else:
            print("⚠️ No Chrome/Chromium binary found, trying without explicit path")
    
    try:
        if is_ci:
            print("🤖 Running in CI mode - using system ChromeDriver")
            
            # Try ultra-minimal approach first - no user data dir at all
            try:
                print("🔄 Attempt 1: Ultra-minimal Chrome (no user data dir)")
                minimal_options = Options()
                minimal_options.add_argument('--headless=new')  # Use new headless mode
                minimal_options.add_argument('--no-sandbox')
                minimal_options.add_argument('--disable-dev-shm-usage')
                minimal_options.add_argument('--disable-gpu')
                minimal_options.add_argument('--disable-extensions')
                minimal_options.add_argument('--disable-plugins')
                minimal_options.add_argument('--disable-images')
                minimal_options.add_argument('--disable-javascript')  # Disable JS initially to test
                minimal_options.add_argument('--disable-web-security')
                minimal_options.add_argument('--disable-features=VizDisplayCompositor')
                minimal_options.add_argument('--no-first-run')
                minimal_options.add_argument('--no-default-browser-check')
                minimal_options.add_argument('--disable-sync')
                minimal_options.add_argument('--disable-background-networking')
                minimal_options.add_argument('--disable-translate')
                minimal_options.add_argument('--disable-component-update')
                minimal_options.add_argument('--disable-default-apps')
                minimal_options.add_argument('--disable-client-side-phishing-detection')
                minimal_options.add_argument('--disable-background-timer-throttling')
                minimal_options.add_argument('--disable-backgrounding-occluded-windows')
                minimal_options.add_argument('--disable-renderer-backgrounding')
                minimal_options.add_argument('--disable-ipc-flooding-protection')
                minimal_options.add_argument('--disable-features=MediaRouter')
                minimal_options.add_argument('--disable-logging')
                minimal_options.add_argument('--silent')
                minimal_options.add_argument('--disable-software-rasterizer')
                minimal_options.add_argument('--disable-background-downloads')
                minimal_options.add_argument('--disable-add-to-shelf')
                minimal_options.add_argument('--disable-demo-mode')
                minimal_options.add_argument('--window-size=1920,1080')
                
                if chrome_binary:
                    minimal_options.binary_location = chrome_binary
                
                driver = webdriver.Chrome(options=minimal_options)
                print("✅ Chrome WebDriver initialized successfully (ultra-minimal)")
                return driver
                
            except Exception as e1:
                print(f"❌ Attempt 1 failed: {e1}")
                
                try:
                    print("🔄 Attempt 2: With JavaScript enabled")
                    js_options = Options()
                    js_options.add_argument('--headless=new')
                    js_options.add_argument('--no-sandbox')
                    js_options.add_argument('--disable-dev-shm-usage')
                    js_options.add_argument('--disable-gpu')
                    js_options.add_argument('--disable-extensions')
                    js_options.add_argument('--disable-plugins')
                    js_options.add_argument('--disable-web-security')
                    js_options.add_argument('--no-first-run')
                    js_options.add_argument('--no-default-browser-check')
                    js_options.add_argument('--disable-sync')
                    js_options.add_argument('--disable-translate')
                    js_options.add_argument('--disable-default-apps')
                    js_options.add_argument('--disable-logging')
                    js_options.add_argument('--silent')
                    js_options.add_argument('--window-size=1920,1080')
                    js_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
                    
                    if chrome_binary:
                        js_options.binary_location = chrome_binary
                    
                    driver = webdriver.Chrome(options=js_options)
                    print("✅ Chrome WebDriver initialized successfully (with JavaScript)")
                    return driver
                    
                except Exception as e2:
                    print(f"❌ Attempt 2 failed: {e2}")
                    
                    try:
                        print("🔄 Attempt 3: Using temporary directory approach")
                        temp_options = Options()
                        temp_options.add_argument('--headless')
                        temp_options.add_argument('--no-sandbox')
                        temp_options.add_argument('--disable-dev-shm-usage')
                        temp_options.add_argument('--disable-gpu')
                        temp_options.add_argument('--disable-extensions')
                        temp_options.add_argument('--no-first-run')
                        temp_options.add_argument('--disable-default-apps')
                        temp_options.add_argument('--disable-sync')
                        temp_options.add_argument('--window-size=1920,1080')
                        
                        # Create a simple temp directory for this attempt
                        import tempfile
                        temp_dir = tempfile.mkdtemp(prefix='chrome_temp_')
                        temp_options.add_argument(f'--user-data-dir={temp_dir}')
                        print(f"🗂️ Using temporary directory: {temp_dir}")
                        
                        if chrome_binary:
                            temp_options.binary_location = chrome_binary
                        
                        driver = webdriver.Chrome(options=temp_options)
                        print("✅ Chrome WebDriver initialized successfully (temporary directory)")
                        
                        # Store temp_dir for cleanup
                        setup_driver.temp_dir = temp_dir
                        return driver
                        
                    except Exception as e3:
                        print(f"❌ Attempt 3 failed: {e3}")
                        
                        try:
                            print("🔄 Attempt 4: Absolutely minimal (emergency fallback)")
                            emergency_options = Options()
                            emergency_options.add_argument('--headless')
                            emergency_options.add_argument('--no-sandbox')
                            emergency_options.add_argument('--disable-dev-shm-usage')
                            
                            if chrome_binary:
                                emergency_options.binary_location = chrome_binary
                            
                            driver = webdriver.Chrome(options=emergency_options)
                            print("✅ Chrome WebDriver initialized successfully (emergency fallback)")
                            return driver
                            
                        except Exception as e4:
                            print(f"❌ All attempts failed. Final error: {e4}")
                            print("💡 Debugging info:")
                            print(f"   Chrome binary: {chrome_binary}")
                            print(f"   CI environment: {is_ci}")
                            return None
        else:
            # Local development
            print("💻 Running in local mode - using webdriver-manager")
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            print("✅ Chrome WebDriver initialized successfully")
            return driver
        
    except WebDriverException as e:
        print(f"❌ Chrome WebDriver error: {e}")
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
        
        # Cleanup temporary user data directories
        if hasattr(setup_driver, 'user_data_dir') and setup_driver.user_data_dir:
            try:
                if os.path.exists(setup_driver.user_data_dir):
                    shutil.rmtree(setup_driver.user_data_dir)
                    print(f"🧹 Cleaned up user data directory: {setup_driver.user_data_dir}")
            except Exception as cleanup_error:
                print(f"⚠️ Could not cleanup user data directory: {cleanup_error}")
    
    return organizations

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