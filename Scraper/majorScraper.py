import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException

def setup_driver():
    """Set up Chrome WebDriver with appropriate options."""
    chrome_options = Options()
    
    # Add options for better compatibility
    chrome_options.add_argument('--headless')  # Run in background (remove this line if you want to see the browser)
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except WebDriverException as e:
        print(f"❌ Chrome WebDriver error: {e}")
        print("💡 Make sure you have ChromeDriver installed:")
        print("   - Download from: https://chromedriver.chromium.org/")
        print("   - Or install via: brew install chromedriver (Mac) or apt-get install chromium-chromedriver (Linux)")
        print("   - Or use: pip install webdriver-manager")
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