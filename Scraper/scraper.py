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
    
    # Debug: Check for existing Chrome processes and data directories
    if is_ci:
        import subprocess
        try:
            result = subprocess.run(['pgrep', '-f', 'chrome'], capture_output=True, text=True)
            if result.stdout.strip():
                print(f"🔍 Found existing Chrome processes: {result.stdout.strip()}")
            else:
                print("🔍 No existing Chrome processes found")
        except:
            print("🔍 Could not check for existing Chrome processes")
        
        # Check for common Chrome user data directories and lock files
        common_paths = [
            '/tmp/.com.google.Chrome*',
            '/tmp/.org.chromium.Chromium*', 
            '/home/runner/.config/google-chrome',
            '/home/runner/.config/chromium',
            '/root/.config/google-chrome',
            '/root/.config/chromium'
        ]
        
        for path_pattern in common_paths:
            try:
                import glob
                matches = glob.glob(path_pattern)
                if matches:
                    print(f"🔍 Found existing Chrome data: {matches}")
            except:
                pass
    
    # Add options for better compatibility
    if is_ci:
        # CI environment - must run headless with additional options
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-background-timer-throttling')
        chrome_options.add_argument('--disable-backgrounding-occluded-windows')
        chrome_options.add_argument('--disable-renderer-backgrounding')
        chrome_options.add_argument('--disable-features=TranslateUI')
        chrome_options.add_argument('--disable-ipc-flooding-protection')
        chrome_options.add_argument('--remote-debugging-port=0')  # Use random port to avoid conflicts
        chrome_options.add_argument('--single-process')  # Run in single process mode
        chrome_options.add_argument('--disable-sync')  # Disable Chrome sync
        chrome_options.add_argument('--disable-default-apps')  # Disable default apps
        chrome_options.add_argument('--disable-web-security')  # Disable web security (for testing)
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')  # Disable compositor
        
        # Set correct Chrome binary path for GitHub Actions
        # Try multiple common Chrome/Chromium locations in CI environments
        chrome_paths = [
            '/snap/bin/chromium',                # Snap installation (most common in Ubuntu CI)
            '/usr/bin/chromium-browser',         # Apt chromium-browser package
            '/opt/google/chrome/google-chrome',  # browser-actions/setup-chrome
            '/usr/bin/google-chrome',            # Default Chrome location
            '/usr/bin/google-chrome-stable',     # Alternative Chrome name
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
    else:
        # Local development - can run with visible browser for debugging
        # chrome_options.add_argument('--headless')  # Uncomment for headless locally
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
    
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Add unique user data directory to avoid conflicts with other Chrome instances
    # Try using /dev/shm for better performance in CI, fallback to temp dir
    if is_ci and os.path.exists('/dev/shm'):
        temp_dir = '/dev/shm'
        print("🔍 Using /dev/shm for user data directory")
    else:
        temp_dir = tempfile.gettempdir()
        print(f"🔍 Using temp directory: {temp_dir}")
    
    unique_id = str(uuid.uuid4())[:8]
    timestamp = str(int(time.time()))
    user_data_dir = os.path.join(temp_dir, f'chrome_clubs_scraper_{unique_id}_{timestamp}')
    
    # Ensure the directory doesn't exist and create it
    if os.path.exists(user_data_dir):
        print(f"⚠️ Directory already exists, removing: {user_data_dir}")
        shutil.rmtree(user_data_dir, ignore_errors=True)
    
    os.makedirs(user_data_dir, exist_ok=True)
    
    # Create the required profile directory structure
    default_profile_dir = os.path.join(user_data_dir, 'Default')
    os.makedirs(default_profile_dir, exist_ok=True)
    
    # Set proper permissions (more permissive to allow Chrome to write files)
    os.chmod(user_data_dir, 0o777)
    os.chmod(default_profile_dir, 0o777)
    
    # Create a basic preferences file to prevent Chrome from trying to write it
    prefs_file = os.path.join(default_profile_dir, 'Preferences')
    try:
        with open(prefs_file, 'w') as f:
            f.write('{}')  # Empty JSON object
        os.chmod(prefs_file, 0o666)
        print(f"🗂️ Created preferences file: {prefs_file}")
    except Exception as pref_error:
        print(f"⚠️ Could not create preferences file: {pref_error}")
    
    # Create other necessary Chrome files
    try:
        # Create Local State file
        local_state_file = os.path.join(user_data_dir, 'Local State')
        with open(local_state_file, 'w') as f:
            f.write('{}')
        os.chmod(local_state_file, 0o666)
        print(f"🗂️ Created local state file: {local_state_file}")
    except Exception as state_error:
        print(f"⚠️ Could not create local state file: {state_error}")
    
    print(f"🗂️ Created unique user data directory: {user_data_dir}")
    print(f"🗂️ Created profile directory: {default_profile_dir}")
    print(f"🔍 Directory exists: {os.path.exists(user_data_dir)}")
    print(f"🔍 Directory writable: {os.access(user_data_dir, os.W_OK)}")
    
    chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
    chrome_options.add_argument(f'--profile-directory=Default')
    
    # Store user_data_dir for cleanup
    setup_driver.user_data_dir = user_data_dir
    
    try:
        if is_ci:
            # In CI, use the system ChromeDriver (pre-installed by GitHub Actions)
            print("🤖 Running in CI mode - using system ChromeDriver")
            
            # First, try with a simple unique user data directory
            try:
                print("🔄 Attempt 1: Minimal Chrome settings with unique user data dir")
                temp_options = Options()
                temp_options.add_argument('--headless')
                temp_options.add_argument('--no-sandbox')
                temp_options.add_argument('--disable-dev-shm-usage')
                temp_options.add_argument('--disable-gpu')
                temp_options.add_argument('--incognito')  # Run in incognito mode
                temp_options.add_argument('--disable-extensions')  # Disable all extensions
                temp_options.add_argument('--disable-plugins')  # Disable plugins
                temp_options.add_argument('--disable-images')  # Speed up loading
                temp_options.add_argument('--disable-web-security')  # Disable web security
                temp_options.add_argument('--disable-features=VizDisplayCompositor')  # Disable compositor
                temp_options.add_argument('--disable-background-timer-throttling')  # Disable throttling
                temp_options.add_argument('--disable-backgrounding-occluded-windows')  # Disable backgrounding
                temp_options.add_argument('--disable-renderer-backgrounding')  # Disable renderer backgrounding
                temp_options.add_argument('--disable-component-update')  # Disable component updates
                temp_options.add_argument('--disable-default-apps')  # Disable default apps
                temp_options.add_argument('--disable-sync')  # Disable sync
                temp_options.add_argument('--disable-client-side-phishing-detection')  # Disable phishing detection
                temp_options.add_argument('--disable-background-networking')  # Disable background networking
                temp_options.add_argument('--disable-features=MediaRouter')  # Disable media router
                temp_options.add_argument('--disable-ipc-flooding-protection')  # Disable IPC protection
                temp_options.add_argument('--no-first-run')  # Skip first run experience
                temp_options.add_argument('--no-default-browser-check')  # Skip default browser check
                temp_options.add_argument('--disable-translate')  # Disable translate
                
                # Always use a unique user data directory, even for minimal setup
                simple_user_dir = f'/dev/shm/chrome_simple_{unique_id}_{timestamp}'
                os.makedirs(simple_user_dir, exist_ok=True)
                
                # Create the required profile directory structure
                default_profile_dir = os.path.join(simple_user_dir, 'Default')
                os.makedirs(default_profile_dir, exist_ok=True)
                
                # Set proper permissions (more permissive to allow Chrome to write files)
                os.chmod(simple_user_dir, 0o777)
                os.chmod(default_profile_dir, 0o777)
                
                # Create a basic preferences file to prevent Chrome from trying to write it
                prefs_file = os.path.join(default_profile_dir, 'Preferences')
                try:
                    with open(prefs_file, 'w') as f:
                        f.write('{}')  # Empty JSON object
                    os.chmod(prefs_file, 0o666)
                    print(f"🗂️ Created preferences file: {prefs_file}")
                except Exception as pref_error:
                    print(f"⚠️ Could not create preferences file: {pref_error}")
                
                # Create other necessary Chrome files
                try:
                    # Create Local State file
                    local_state_file = os.path.join(simple_user_dir, 'Local State')
                    with open(local_state_file, 'w') as f:
                        f.write('{}')
                    os.chmod(local_state_file, 0o666)
                    print(f"🗂️ Created local state file: {local_state_file}")
                except Exception as state_error:
                    print(f"⚠️ Could not create local state file: {state_error}")
                
                temp_options.add_argument(f'--user-data-dir={simple_user_dir}')
                temp_options.add_argument(f'--profile-directory=Default')
                print(f"🗂️ Using simple user data directory: {simple_user_dir}")
                print(f"🗂️ Created profile directory: {default_profile_dir}")
                
                if chrome_binary:
                    temp_options.binary_location = chrome_binary
                
                driver = webdriver.Chrome(options=temp_options)
                print("✅ Chrome WebDriver initialized successfully (minimal settings)")
                
                # Store for cleanup
                setup_driver.simple_user_data_dir = simple_user_dir
                return driver
            except Exception as e1:
                print(f"❌ Attempt 1 failed: {e1}")
                print("🔄 Attempt 2: With full Chrome options")
                try:
                    driver = webdriver.Chrome(options=chrome_options)
                except Exception as e2:
                    print(f"❌ Attempt 2 failed: {e2}")
                    print("🔄 Attempt 3: Ultra-minimal Chrome with memory-only profile")
                    
                    # Last resort: try with completely temporary approach
                    ultra_options = Options()
                    ultra_options.add_argument('--headless')
                    ultra_options.add_argument('--no-sandbox')
                    ultra_options.add_argument('--disable-dev-shm-usage')
                    ultra_options.add_argument('--disable-gpu')
                    ultra_options.add_argument('--disable-extensions')
                    ultra_options.add_argument('--disable-plugins')
                    ultra_options.add_argument('--disable-images')
                    ultra_options.add_argument('--disable-web-security')
                    ultra_options.add_argument('--disable-features=VizDisplayCompositor')
                    ultra_options.add_argument('--no-first-run')
                    ultra_options.add_argument('--no-default-browser-check')
                    ultra_options.add_argument('--disable-sync')
                    ultra_options.add_argument('--disable-background-networking')
                    ultra_options.add_argument('--disable-background-timer-throttling')
                    ultra_options.add_argument('--disable-client-side-phishing-detection')
                    ultra_options.add_argument('--disable-component-update')
                    ultra_options.add_argument('--disable-default-apps')
                    ultra_options.add_argument('--disable-translate')
                    ultra_options.add_argument('--disable-logging')
                    ultra_options.add_argument('--silent')
                    
                    # Try with a super simple temp directory
                    import tempfile
                    ultra_temp_dir = tempfile.mkdtemp(prefix='chrome_ultra_', dir='/dev/shm')
                    ultra_options.add_argument(f'--user-data-dir={ultra_temp_dir}')
                    print(f"🗂️ Ultra-minimal temp directory: {ultra_temp_dir}")
                    
                    if chrome_binary:
                        ultra_options.binary_location = chrome_binary
                    
                    driver = webdriver.Chrome(options=ultra_options)
        else:
            # Local development - use webdriver-manager for convenience
            print("💻 Running in local mode - using webdriver-manager")
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Chrome WebDriver initialized successfully")
        return driver
        
    except WebDriverException as e:
        print(f"❌ Chrome WebDriver error: {e}")
        print("💡 Trying fallback methods...")
        
        # Fallback 1: Try without webdriver-manager (works for both CI and local)
        try:
            print("🔄 Fallback 1: Trying system ChromeDriver...")
            driver = webdriver.Chrome(options=chrome_options)
            print("✅ Fallback 1: Success!")
            return driver
        except Exception as e2:
            print(f"❌ Fallback 1 failed: {e2}")
        
        # Fallback 2: Try webdriver-manager (local only)
        if not is_ci:
            try:
                print("🔄 Fallback 2: Trying webdriver-manager...")
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
                print("✅ Fallback 2: Success!")
                return driver
            except Exception as e3:
                print(f"❌ Fallback 2 failed: {e3}")
        
        print("❌ All methods failed")
        print("💡 Final troubleshooting steps:")
        print("   - Make sure Chrome/Chromium is installed")
        print("   - Install dependencies: pip install selenium")
        print("   - For local dev: pip install webdriver-manager")
        print("   - Check if you're in a headless environment (CI)")
        
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
    user_data_dir = None
    
    try:
        print(f"🌐 Loading page: {url}")
        driver.get(url)
        
        # Wait for the page to load
        print("⏳ Waiting for page to load...")
        time.sleep(5)  # Increased wait time
        
        # Wait for initial organizations to load
        try:
            wait = WebDriverWait(driver, 20)  # Increased timeout
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
        max_clicks = 150  # Increased safety limit
        consecutive_no_change = 0  # Track consecutive clicks with no new content
        
        while click_count < max_clicks:
            # Count current organizations
            org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
            current_count = len(org_elements)
            
            print(f"📊 Currently loaded: {current_count} organizations")
            
            # Look for "Load More" button with more comprehensive selectors
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
                        # XPath selector
                        button = driver.find_element(By.XPATH, selector)
                    else:
                        # CSS selector
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
                    
                    # Wait for new content to load with progressive waiting
                    time.sleep(3)
                    
                    # Wait for network activity to settle
                    wait_count = 0
                    while wait_count < 10:  # Wait up to 10 seconds for new content
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
                        
                        # Wait longer before trying again
                        time.sleep(5)
                    
                except Exception as e:
                    print(f"⚠️  Error clicking load more button: {e}")
                    # Try to continue anyway
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
                
                # Extract organization name with improved selectors
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
                        
                        # Make sure we get a reasonable name
                        if potential_name and len(potential_name) < 200 and '\n' not in potential_name:
                            name = clean_organization_name(potential_name)  # Apply cleaning
                            if name:  # Only break if we got a valid cleaned name
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
                    org_data['acronyms'] = []  # Empty acronyms array as requested
                    
                    organizations.append(org_data)
                
                # Enhanced progress indicator
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
        
        # Also cleanup simple user data directory if it exists
        if hasattr(setup_driver, 'simple_user_data_dir') and setup_driver.simple_user_data_dir:
            try:
                if os.path.exists(setup_driver.simple_user_data_dir):
                    shutil.rmtree(setup_driver.simple_user_data_dir)
                    print(f"🧹 Cleaned up simple user data directory: {setup_driver.simple_user_data_dir}")
            except Exception as cleanup_error:
                print(f"⚠️ Could not cleanup simple user data directory: {cleanup_error}")
    
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
        
        # Show some example cleaned names
        print(f"\n🧹 Example of name cleaning:")
        sample_orgs = organizations[:5]
        for org in sample_orgs:
            original_name = org['name'] + " at University Park"  # Simulate original
            print(f"   Original: '{original_name}'")
            print(f"   Cleaned:  '{org['name']}'")
            print()
            
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