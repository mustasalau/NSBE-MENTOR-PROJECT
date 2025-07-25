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
            
            # In CI, try different Firefox approaches
            firefox_approaches = [
                {
                    'name': 'System Firefox with profile',
                    'binary': '/usr/bin/firefox',
                    'use_profile': True
                },
                {
                    'name': 'Snap Firefox',
                    'binary': '/snap/bin/firefox', 
                    'use_profile': True
                },
                {
                    'name': 'System Firefox minimal',
                    'binary': '/usr/bin/firefox',
                    'use_profile': False
                },
                {
                    'name': 'Auto-detect Firefox',
                    'binary': None,
                    'use_profile': False
                }
            ]
            
            for i, approach in enumerate(firefox_approaches, 1):
                try:
                    print(f"  🔄 Firefox attempt {i}: {approach['name']}")
                    
                    # Create fresh options for each attempt
                    opts = FirefoxOptions()
                    opts.add_argument('--headless')
                    opts.add_argument('--no-sandbox')
                    opts.add_argument('--disable-dev-shm-usage')
                    opts.add_argument('--window-size=1920,1080')
                    
                    # Set binary if specified
                    if approach['binary'] and os.path.exists(approach['binary']):
                        opts.binary_location = approach['binary']
                        print(f"    Using Firefox binary: {approach['binary']}")
                    
                    # Set profile if needed
                    if approach['use_profile']:
                        profile_dir = f"/tmp/firefox_profile_{os.getpid()}_{int(time.time())}"
                        opts.add_argument(f'--profile={profile_dir}')
                        print(f"    Using profile: {profile_dir}")
                    
                    # Try to create driver
                    driver = webdriver.Firefox(options=opts)
                    print(f"  ✅ Firefox approach {i} successful!")
                    return driver
                    
                except Exception as e:
                    print(f"  ❌ Firefox approach {i} failed: {e}")
                    continue
            
            print("❌ All Firefox approaches failed")
            return None
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
        
        # Strategy 3: Try Chrome with completely different approach
        print("\n🔄 Strategy 3: Chrome with temp directory override")
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--single-process')
            chrome_options.add_argument('--no-zygote')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            chrome_options.add_argument('--no-first-run')
            chrome_options.add_argument('--disable-default-apps')
            
            # Create a completely unique user data directory in /tmp
            import uuid
            unique_id = str(uuid.uuid4())
            temp_user_data = f"/tmp/chrome_ci_{unique_id}_{int(time.time() * 1000000)}"
            
            # Ensure directory doesn't exist and create it
            if os.path.exists(temp_user_data):
                shutil.rmtree(temp_user_data, ignore_errors=True)
                time.sleep(0.5)
            
            os.makedirs(temp_user_data, mode=0o755)
            chrome_options.add_argument(f'--user-data-dir={temp_user_data}')
            print(f"  Using unique temp directory: {temp_user_data}")
            
            # Try different Chrome binaries based on debug info
            chrome_binaries = ['/snap/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
            
            for chrome_binary in chrome_binaries:
                if os.path.exists(chrome_binary):
                    try:
                        print(f"  🔍 Trying Chrome binary: {chrome_binary}")
                        chrome_options.binary_location = chrome_binary
                        
                        driver = webdriver.Chrome(options=chrome_options)
                        print(f"  ✅ Chrome successful with {chrome_binary}")
                        
                        # Store cleanup info
                        setup_driver.cleanup_dir = temp_user_data
                        return driver, None
                        
                    except Exception as e:
                        print(f"  ❌ Chrome failed with {chrome_binary}: {e}")
                        continue
            
            # Cleanup temp directory if all failed
            if os.path.exists(temp_user_data):
                shutil.rmtree(temp_user_data, ignore_errors=True)
                
        except Exception as e:
            print(f"❌ Chrome strategy failed: {e}")
        
        # Strategy 4: Try Chrome without user data directory at all
        print("\n🔄 Strategy 4: Chrome without user data directory")
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--incognito')
            chrome_options.add_argument('--no-first-run')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            chrome_options.add_argument('--disable-default-apps')
            chrome_options.add_argument('--disable-sync')
            chrome_options.add_argument('--disable-background-networking')
            # Try to disable user data directory entirely
            chrome_options.add_argument('--disable-features=UserDataDir')
            chrome_options.add_argument('--disable-features=ProfileManagement')
            
            # Use /snap/bin/chromium which worked in debug
            chrome_options.binary_location = '/snap/bin/chromium'
            
            driver = webdriver.Chrome(options=chrome_options)
            print("  ✅ Chrome without user data directory successful!")
            return driver, None
            
        except Exception as e:
            print(f"  ❌ Chrome without user data directory failed: {e}")
        
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
        max_clicks = 150  # Increased to handle all organizations
        consecutive_no_change = 0
        target_count = 1212
        
        print(f"🎯 Starting Load More clicking - Target: {target_count}+ organizations")
        
        while click_count < max_clicks:
            # Count current organizations
            org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
            current_count = len(org_elements)
            
            print(f"📊 Currently loaded: {current_count} organizations (Click #{click_count})")
            
            # Check if we've reached our target
            if current_count >= target_count:
                print(f"🎯 Target reached! Found {current_count} organizations")
                break
            
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
                        break
                except:
                    continue
            
            if load_more_button:
                try:
                    # Scroll to the button and wait
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", load_more_button)
                    time.sleep(1)  # Reduced from 2 to 1 second
                    
                    # Try clicking with JavaScript if regular click fails
                    try:
                        load_more_button.click()
                    except:
                        driver.execute_script("arguments[0].click();", load_more_button)
                    
                    click_count += 1
                    print(f"🔄 Clicked 'Load More' button #{click_count}")
                    
                    # Wait for new content to load - reduced initial wait
                    time.sleep(1.5)  # Reduced from 3 to 1.5 seconds
                    
                    # Wait for network activity to settle with adaptive timing
                    wait_count = 0
                    max_wait = 8  # Reduced from 10 to 8
                    last_count = current_count
                    
                    while wait_count < max_wait:
                        time.sleep(0.5)  # Check more frequently
                        new_org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
                        new_count = len(new_org_elements)
                        
                        if new_count > last_count:
                            print(f"📈 New organizations loaded: {new_count - current_count} (total: {new_count})")
                            consecutive_no_change = 0
                            break
                        
                        last_count = new_count
                        wait_count += 1
                    
                    # Check final count after waiting
                    final_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
                    final_count = len(final_elements)
                    
                    # If no new organizations loaded
                    if final_count == current_count:
                        consecutive_no_change += 1
                        print(f"⚠️  No new organizations loaded (attempt {consecutive_no_change})")
                        
                        if consecutive_no_change >= 3:
                            print(f"✅ No more organizations to load after {consecutive_no_change} attempts. Final count: {final_count}")
                            break
                        
                        # Longer wait only when no progress
                        time.sleep(3)
                    else:
                        # Reset consecutive failures if we got new content
                        consecutive_no_change = 0
                    
                except Exception as e:
                    print(f"⚠️  Error clicking load more button: {e}")
                    consecutive_no_change += 1
                    if consecutive_no_change >= 3:
                        print(f"❌ Too many click failures, stopping")
                        break
                    time.sleep(2)  # Brief wait before retrying
            else:
                print("🏁 No 'Load More' button found - all organizations loaded")
                break
        
        # Final summary
        final_org_elements = driver.find_elements(By.CSS_SELECTOR, "a[href*='/organization/']")
        final_org_count = len(final_org_elements)
        print(f"🏁 Load More clicking completed: {final_org_count} organizations loaded after {click_count} clicks")
        
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
            if hasattr(setup_driver, 'cleanup_dir') and setup_driver.cleanup_dir:
                try:
                    if os.path.exists(setup_driver.cleanup_dir):
                        shutil.rmtree(setup_driver.cleanup_dir)
                        print(f"🧹 Cleaned up temp directory: {setup_driver.cleanup_dir}")
                except Exception as cleanup_error:
                    print(f"⚠️ Could not cleanup temp directory: {cleanup_error}")
            
            cleanup_browser_processes()

    return organizations

def debug_environment():
    """Debug the current environment to understand CI vs local differences."""
    print("🔍 ENVIRONMENT DEBUG INFORMATION")
    print("=" * 60)
    
    # Operating System Info
    import platform
    print(f"🖥️  Operating System: {platform.system()} {platform.release()}")
    print(f"🖥️  Platform: {platform.platform()}")
    print(f"🖥️  Python Version: {platform.python_version()}")
    
    # Environment Variables
    import os
    ci_vars = ['CI', 'GITHUB_ACTIONS', 'RUNNER_OS', 'RUNNER_ARCH']
    print(f"\n🌍 Environment Variables:")
    for var in ci_vars:
        value = os.environ.get(var, 'Not set')
        print(f"    {var}: {value}")
    
    # User and Permissions
    print(f"\n👤 User Information:")
    print(f"    User ID: {os.getuid() if hasattr(os, 'getuid') else 'N/A'}")
    print(f"    Group ID: {os.getgid() if hasattr(os, 'getgid') else 'N/A'}")
    print(f"    Current Working Directory: {os.getcwd()}")
    
    # File System Info
    print(f"\n📁 File System:")
    important_dirs = ['/tmp', '/dev/shm', '/home', '/usr/bin', '/usr/local/bin']
    for dir_path in important_dirs:
        if os.path.exists(dir_path):
            writeable = os.access(dir_path, os.W_OK)
            executable = os.access(dir_path, os.X_OK)
            print(f"    {dir_path}: Exists ✓, Writable: {'✓' if writeable else '❌'}, Executable: {'✓' if executable else '❌'}")
        else:
            print(f"    {dir_path}: Does not exist ❌")
    
    # Available Browsers
    print(f"\n🌐 Browser Binaries:")
    browser_paths = {
        'Chrome': ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/google-chrome'],
        'Chromium': ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
        'Firefox': ['/usr/bin/firefox', '/usr/bin/firefox-esr', '/snap/bin/firefox', '/opt/firefox/firefox']
    }
    
    for browser, paths in browser_paths.items():
        print(f"    {browser}:")
        found = False
        for path in paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                try:
                    import subprocess
                    version_result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=10)
                    version = version_result.stdout.strip() if version_result.returncode == 0 else 'Version unknown'
                    print(f"      ✓ {path} - {version}")
                    found = True
                except:
                    print(f"      ✓ {path} - Found but version check failed")
                    found = True
            else:
                print(f"      ❌ {path}")
        if not found:
            print(f"      ❌ No {browser} binary found")
    
    # WebDriver Binaries
    print(f"\n🔧 WebDriver Binaries:")
    webdriver_paths = {
        'ChromeDriver': ['/usr/bin/chromedriver', '/usr/local/bin/chromedriver', '/usr/lib/chromium-browser/chromedriver'],
        'GeckoDriver': ['/usr/bin/geckodriver', '/usr/local/bin/geckodriver']
    }
    
    for driver, paths in webdriver_paths.items():
        print(f"    {driver}:")
        found = False
        for path in paths:
            if os.path.exists(path) and os.access(path, os.X_OK):
                try:
                    import subprocess
                    version_result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=10)
                    version_lines = version_result.stdout.strip().split('\n') if version_result.returncode == 0 else ['Version unknown']
                    version = version_lines[0] if version_lines else 'Version unknown'
                    print(f"      ✓ {path} - {version}")
                    found = True
                except:
                    print(f"      ✓ {path} - Found but version check failed")
                    found = True
            else:
                print(f"      ❌ {path}")
        if not found:
            print(f"      ❌ No {driver} binary found")
    
    # Running Processes
    print(f"\n🔄 Running Processes:")
    try:
        import subprocess
        for process_name in ['chrome', 'chromium', 'firefox', 'geckodriver', 'chromedriver']:
            result = subprocess.run(['pgrep', '-f', process_name], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                count = len(result.stdout.strip().split('\n'))
                print(f"    {process_name}: {count} processes running")
            else:
                print(f"    {process_name}: No processes running")
    except:
        print("    Unable to check running processes")
    
    # Memory and Disk
    print(f"\n💾 System Resources:")
    try:
        import subprocess
        # Memory info
        try:
            mem_result = subprocess.run(['free', '-h'], capture_output=True, text=True, timeout=5)
            if mem_result.returncode == 0:
                mem_lines = mem_result.stdout.strip().split('\n')
                if len(mem_lines) >= 2:
                    print(f"    Memory: {mem_lines[1]}")
        except:
            print("    Memory: Unable to check")
        
        # Disk space
        try:
            disk_result = subprocess.run(['df', '-h', '/tmp'], capture_output=True, text=True, timeout=5)
            if disk_result.returncode == 0:
                disk_lines = disk_result.stdout.strip().split('\n')
                if len(disk_lines) >= 2:
                    print(f"    /tmp disk space: {disk_lines[1]}")
        except:
            print("    Disk space: Unable to check")
    except:
        print("    Unable to check system resources")
    
    # Network connectivity
    print(f"\n🌍 Network Connectivity:")
    try:
        import requests
        test_result = requests.get('https://httpbin.org/ip', timeout=10)
        if test_result.status_code == 200:
            print(f"    Internet connectivity: ✓ Working")
            ip_info = test_result.json()
            print(f"    Public IP: {ip_info.get('origin', 'Unknown')}")
        else:
            print(f"    Internet connectivity: ❌ HTTP {test_result.status_code}")
    except Exception as e:
        print(f"    Internet connectivity: ❌ Failed - {e}")
    
    print("=" * 60)
    print("🔍 END ENVIRONMENT DEBUG\n")

def main():
    print("🏫 Penn State Organizations Scraper")
    print("=" * 50)
    print("📋 Target: 1212+ organizations")
    print("🔄 Multi-strategy approach: Requests → Firefox → Chrome")
    print("✂️  Organization names will be cleaned")
    print("=" * 50)
    
    # Add environment debugging
    debug_environment()
    
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