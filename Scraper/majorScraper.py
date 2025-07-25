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
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    """Set up Chrome WebDriver with appropriate options."""
    chrome_options = Options()
    
    # Detect if running in CI environment
    is_ci = os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS')
    
    # Debug: Check for existing Chrome processes
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
        chrome_options.add_argument('--headless')  # Comment out to see browser locally
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
    user_data_dir = os.path.join(temp_dir, f'chrome_majors_scraper_{unique_id}_{timestamp}')
    
    # Ensure the directory doesn't exist and create it
    if os.path.exists(user_data_dir):
        print(f"⚠️ Directory already exists, removing: {user_data_dir}")
        shutil.rmtree(user_data_dir, ignore_errors=True)
    
    os.makedirs(user_data_dir, exist_ok=True)
    print(f"🗂️ Created unique user data directory: {user_data_dir}")
    print(f"🔍 Directory exists: {os.path.exists(user_data_dir)}")
    print(f"🔍 Directory writable: {os.access(user_data_dir, os.W_OK)}")
    
    chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
    
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
                
                # Always use a unique user data directory, even for minimal setup
                simple_user_dir = f'/dev/shm/chrome_majors_simple_{unique_id}_{timestamp}'
                os.makedirs(simple_user_dir, exist_ok=True)
                temp_options.add_argument(f'--user-data-dir={simple_user_dir}')
                print(f"🗂️ Using simple user data directory: {simple_user_dir}")
                
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
                driver = webdriver.Chrome(options=chrome_options)
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

def scrape_penn_state_majors_selenium():
    """
    Scrape Penn State majors using Selenium to handle JavaScript filtering.
    """
    
    # The specific URL with filters applied
    url = 'https://bulletins.psu.edu/programs/#filter=.filter_22&.filter_87'
    
    driver = setup_driver()
    if not driver:
        return []
    
    majors = []
    
    try:
        print(f"🌐 Loading page: {url}")
        driver.get(url)
        
        # Wait for the page to load completely
        print("⏳ Waiting for page to load...")
        time.sleep(3)
        
        # Wait for the filtering to complete - look for the title spans to be present
        try:
            wait = WebDriverWait(driver, 15)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "span.title")))
            print("✅ Page loaded successfully")
        except TimeoutException:
            print("⚠️  Timeout waiting for elements, but continuing...")
        
        # Give extra time for JavaScript filtering to complete
        print("⏳ Waiting for JavaScript filters to apply...")
        time.sleep(5)
        
        # Find all span elements with class="title"
        title_elements = driver.find_elements(By.CSS_SELECTOR, "span.title")
        
        print(f"🎯 Found {len(title_elements)} <span class='title'> elements after filtering")
        
        if title_elements:
            for element in title_elements:
                try:
                    title_text = element.text.strip()
                    if title_text:
                        # Remove campus information in parentheses
                        clean_title = title_text.split('(')[0].strip()
                        
                        # Only add if it's not empty after cleaning
                        if clean_title:
                            majors.append(clean_title)
                            
                except Exception as e:
                    print(f"⚠️  Error extracting text from element: {e}")
                    continue
                    
            print(f"📝 Extracted {len(majors)} program titles")
        else:
            print("❌ No <span class='title'> elements found")
            
            # Debug: Check what's actually on the page
            print("🔍 Debugging - checking page source...")
            page_source = driver.page_source
            if 'filter_22' in page_source:
                print("✅ Filter parameters found in page source")
            else:
                print("❌ Filter parameters not found - JavaScript might not have executed")
            
            # Check for alternative selectors
            alternative_selectors = ['.title', '[class*="title"]', 'h3', '.program-title']
            for selector in alternative_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"🔍 Found {len(elements)} elements with selector: {selector}")
                    # Show first few as examples
                    for i, elem in enumerate(elements[:3]):
                        try:
                            text = elem.text.strip()
                            if text:
                                print(f"   📄 Example {i+1}: {text}")
                        except:
                            pass
    
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
    
    return majors

def main():
    print("🎓 Penn State Majors Scraper (Selenium Version)")
    print("=" * 60)
    print("📋 This version can handle JavaScript filtering")
    print("🔧 Make sure you have ChromeDriver installed!")
    print("=" * 60)
    
    majors = scrape_penn_state_majors_selenium()
    
    if majors:
        # Remove duplicates while preserving order
        unique_majors = list(dict.fromkeys(majors))
        
        # Further clean up - remove variations of the same program
        cleaned_majors = []
        seen_base_names = set()
        
        for major in unique_majors:
            # Extract the base program name (everything before the first comma)
            if ',' in major:
                base_name = major.split(',')[0].strip()
                degree_type = major.split(',')[1].strip()
                
                # Create a standardized version
                clean_major = f"{base_name}, {degree_type}"
                
                # Only add if we haven't seen this base program before
                if base_name not in seen_base_names:
                    cleaned_majors.append(clean_major)
                    seen_base_names.add(base_name)
            else:
                # Handle cases without commas
                if major not in seen_base_names:
                    cleaned_majors.append(major)
                    seen_base_names.add(major)
        
        # Save to intermediate file for merging process
        output_file = 'penn_state_majors.json'
        with open(output_file, 'w') as f:
            json.dump(cleaned_majors, f, indent=2)
        
        print(f"\n✅ Successfully saved {len(cleaned_majors)} unique majors to {output_file}")
        print("📋 Next step: Run the merge script to update src/data/majors.json")
        
        # Display sample majors
        print(f"\n📋 Sample majors found:")
        for i, major in enumerate(cleaned_majors[:15]):
            print(f"{i+1:2d}. {major}")
        
        if len(cleaned_majors) > 15:
            print(f"... and {len(cleaned_majors) - 15} more")
            
    else:
        print("\n❌ No majors were found.")
        print("💡 Troubleshooting steps:")
        print("   1. Make sure ChromeDriver is installed and in your PATH")
        print("   2. Check if the Penn State website structure has changed")
        print("   3. Try removing --headless option to see the browser in action")
        print("   4. Check your internet connection")

if __name__ == "__main__":
    main()