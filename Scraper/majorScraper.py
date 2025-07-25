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
from selenium.common.exceptions import TimeoutException, WebDriverException
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
        print("🤖 Running in CI mode - using stateless Chrome configuration")
        
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
        
        # Try multiple stateless approaches
        approaches = [
            {
                'name': 'Stateless incognito mode',
                'method': 'stateless_incognito'
            },
            {
                'name': 'Memory-only Chrome',
                'method': 'memory_only'
            },
            {
                'name': 'Single process mode',
                'method': 'single_process'
            },
            {
                'name': 'Ultra minimal',
                'method': 'ultra_minimal'
            }
        ]
        
        for i, approach in enumerate(approaches, 1):
            try:
                print(f"🔄 Attempt {i}: {approach['name']}")
                
                chrome_options = Options()
                
                # Base options for all approaches
                chrome_options.add_argument('--headless=new')
                chrome_options.add_argument('--no-sandbox')
                chrome_options.add_argument('--disable-dev-shm-usage')
                chrome_options.add_argument('--disable-gpu')
                chrome_options.add_argument('--window-size=1920,1080')
                
                if approach['method'] == 'stateless_incognito':
                    # Completely stateless approach - no user data directory at all
                    chrome_options.add_argument('--incognito')
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--no-default-browser-check')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--disable-plugins')
                    chrome_options.add_argument('--disable-sync')
                    chrome_options.add_argument('--disable-translate')
                    chrome_options.add_argument('--disable-background-networking')
                    chrome_options.add_argument('--disable-background-timer-throttling')
                    chrome_options.add_argument('--disable-backgrounding-occluded-windows')
                    chrome_options.add_argument('--disable-renderer-backgrounding')
                    chrome_options.add_argument('--disable-features=TranslateUI')
                    chrome_options.add_argument('--disable-ipc-flooding-protection')
                    chrome_options.add_argument('--remote-debugging-port=0')
                    chrome_options.add_argument('--disable-web-security')
                    chrome_options.add_argument('--disable-features=VizDisplayCompositor')
                    chrome_options.add_argument('--disable-logging')
                    chrome_options.add_argument('--silent')
                    # Explicitly avoid any user data directory
                    chrome_options.add_argument('--disable-session-crashed-bubble')
                    chrome_options.add_argument('--disable-restore-session-state')
                    chrome_options.add_argument('--disable-background-mode')
                    
                elif approach['method'] == 'memory_only':
                    # Use memory-only temporary directory
                    chrome_options.add_argument('--incognito')
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--disable-plugins')
                    chrome_options.add_argument('--disable-sync')
                    chrome_options.add_argument('--single-process')
                    chrome_options.add_argument('--disable-web-security')
                    chrome_options.add_argument('--remote-debugging-port=0')
                    # Use a memory-based temp directory
                    memory_dir = f"/dev/shm/chrome_temp_{os.getpid()}_{int(time.time())}"
                    chrome_options.add_argument(f'--user-data-dir={memory_dir}')
                    
                elif approach['method'] == 'single_process':
                    # Single process with minimal options
                    chrome_options.add_argument('--single-process')
                    chrome_options.add_argument('--no-zygote')
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--disable-plugins')
                    chrome_options.add_argument('--disable-sync')
                    chrome_options.add_argument('--incognito')
                    chrome_options.add_argument('--remote-debugging-port=0')
                    
                elif approach['method'] == 'ultra_minimal':
                    # Absolute minimal configuration
                    chrome_options.add_argument('--incognito')
                    chrome_options.add_argument('--no-first-run')
                    chrome_options.add_argument('--disable-extensions')
                    chrome_options.add_argument('--remote-debugging-port=0')
                
                # Set Chrome binary if found
                if chrome_binary:
                    chrome_options.binary_location = chrome_binary
                
                # Set user agent
                chrome_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
                
                # Try to create the driver
                driver = webdriver.Chrome(options=chrome_options)
                print(f"✅ Chrome WebDriver initialized successfully with approach {i}")
                return driver
                
            except Exception as e:
                print(f"❌ Attempt {i} failed: {e}")
                
                # Cleanup memory directory if it was created
                if approach['method'] == 'memory_only' and 'memory_dir' in locals() and os.path.exists(memory_dir):
                    try:
                        shutil.rmtree(memory_dir)
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
        # No user data directories to cleanup in stateless mode
        
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