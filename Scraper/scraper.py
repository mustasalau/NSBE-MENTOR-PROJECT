from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import openpyxl
import re

def setup_driver():
    """Set up Chrome WebDriver with appropriate options."""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    return webdriver.Chrome(options=options)

def debug_page_structure(driver):
    """Debug function to understand the current page structure."""
    print("🔍 Debugging page structure...")
    
    # Check common container selectors
    possible_containers = [
        ".MuiCard-root",
        "[class*='card']", 
        "[class*='Card']",
        ".organization",
        "[class*='org']",
        ".result",
        "[class*='result']",
        ".item",
        "[class*='item']"
    ]
    
    for selector in possible_containers:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        if elements:
            print(f"✅ Found {len(elements)} elements with selector: {selector}")
            # Show first element's HTML
            try:
                first_element_html = elements[0].get_attribute('outerHTML')[:200]
                print(f"   📄 First element preview: {first_element_html}...")
            except:
                pass
        else:
            print(f"❌ No elements found with selector: {selector}")
    
    # Check for any elements that might contain organization names
    print("\n🔍 Looking for text patterns that might be organization names...")
    all_text_elements = driver.find_elements(By.XPATH, "//*[text()]")
    org_like_texts = []
    
    for element in all_text_elements[:50]:  # Check first 50 text elements
        text = element.text.strip()
        if text and len(text) > 10 and len(text) < 100:  # Reasonable org name length
            # Skip common UI elements
            if not any(skip in text.lower() for skip in ['search', 'filter', 'sort', 'menu', 'button', 'click']):
                org_like_texts.append(text)
    
    if org_like_texts:
        print(f"📝 Found {len(org_like_texts)} potential organization names:")
        for i, text in enumerate(org_like_texts[:10]):
            print(f"   {i+1}. {text}")
    
    return possible_containers

def scrape_student_organizations(url, driver_path=None):
    """
    Enhanced scraper that can handle different page structures.
    """
    driver = setup_driver()
    orgs = []
    seen_names = set()

    try:
        print(f"🌐 Loading page: {url}")
        driver.get(url)
        
        # Wait for page to load completely
        print("⏳ Waiting for initial page load...")
        time.sleep(10)  # Increased initial wait time
        
        # Try to wait for specific elements to be present
        try:
            WebDriverWait(driver, 20).until(
                lambda d: len(d.find_elements(By.XPATH, "//*[contains(@class, 'card') or contains(@class, 'Card') or contains(@class, 'organization') or contains(@class, 'item')]")) > 0
            )
            print("✅ Content elements detected on page")
        except TimeoutException:
            print("⚠️ Timeout waiting for content, proceeding anyway...")
        
        # Additional wait for dynamic content
        print("⏳ Waiting for dynamic content to load...")
        time.sleep(5)
        
        # Debug the page structure first
        possible_containers = debug_page_structure(driver)
        
        # Try different selectors for organization cards
        card_selectors = [
            ".MuiCard-root",
            "[class*='card']",
            "[class*='Card']", 
            ".organization-item",
            ".org-card",
            ".result-item",
            "[data-testid*='org']",
            "[data-testid*='card']"
        ]
        
        cards = []
        working_selector = None
        
        for selector in card_selectors:
            test_cards = driver.find_elements(By.CSS_SELECTOR, selector)
            if test_cards:
                print(f"✅ Using selector: {selector} (found {len(test_cards)} elements)")
                cards = test_cards
                working_selector = selector
                break
        
        if not cards:
            print("❌ No organization cards found with any selector!")
            print("🔍 Trying alternative approach...")
            
            # Alternative: look for any clickable elements that might be organizations
            clickable_elements = driver.find_elements(By.XPATH, "//a | //button | //div[@role='button']")
            potential_orgs = []
            
            for element in clickable_elements:
                text = element.text.strip()
                if text and 10 <= len(text) <= 100:  # Reasonable org name length
                    # Simple heuristic: if it contains certain keywords, it might be an org
                    if any(keyword in text.lower() for keyword in ['club', 'society', 'association', 'organization', 'group']):
                        potential_orgs.append(text)
            
            if potential_orgs:
                print(f"🎯 Found {len(potential_orgs)} potential organizations using alternative method")
                orgs.extend(potential_orgs)
                seen_names.update(potential_orgs)
            
        else:
            # Extract organization names from cards
            name_selectors = [
                "div[style*='font-weight: 600']",
                "h3", "h4", "h5",
                ".title", ".name", ".org-name",
                "[class*='title']", "[class*='name']",
                "strong", "b"
            ]
            
            print(f"🔍 Extracting organization names from {len(cards)} cards...")
            
            for card in cards:
                org_name = None
                
                # Try different selectors for the organization name
                for name_selector in name_selectors:
                    try:
                        name_element = card.find_element(By.CSS_SELECTOR, name_selector)
                        text = name_element.text.strip()
                        if text and len(text) > 5:  # Must be meaningful text
                            org_name = text
                            break
                    except NoSuchElementException:
                        continue
                
                # If no name found with selectors, try getting any text from the card
                if not org_name:
                    card_text = card.text.strip()
                    if card_text:
                        # Take the first line as the org name
                        first_line = card_text.split('\n')[0].strip()
                        if first_line and len(first_line) > 5:
                            org_name = first_line
                
                if org_name and org_name not in seen_names:
                    orgs.append(org_name)
                    seen_names.add(org_name)

            print(f"📋 Extracted {len(orgs)} organization names")

        # Try to load more organizations using multiple strategies
        if working_selector:
            print(f"🔄 Attempting to load more organizations (currently have {len(orgs)} out of ~1212)...")
            
            # Strategy 1: Try clicking load more buttons
            try_load_more(driver, working_selector, orgs, seen_names)
            
            # Strategy 2: Try infinite scroll
            try_infinite_scroll(driver, working_selector, orgs, seen_names)
            
            # Strategy 3: Final aggressive scroll and wait
            try_aggressive_loading(driver, working_selector, orgs, seen_names)

    except Exception as e:
        print(f"❌ Error during scraping: {e}")
        # Save a screenshot for debugging
        try:
            driver.save_screenshot("scraper_error.png")
            print("📸 Screenshot saved as scraper_error.png")
        except:
            pass
    finally:
        driver.quit()

    print(f"🎯 Final count: {len(orgs)} organizations")
    return orgs

def try_load_more(driver, card_selector, orgs, seen_names):
    """Try to click load more buttons to get additional organizations."""
    print("🔘 Strategy 1: Looking for Load More buttons...")
    max_attempts = 20  # Increased attempts
    attempts = 0
    
    while attempts < max_attempts:
        initial_count = len(orgs)
        
        # Look for various "load more" button patterns
        load_more_selectors = [
            "//button[.//span[contains(text(), 'Load More')]]",
            "//button[contains(text(), 'Load More')]",
            "//button[contains(text(), 'Show More')]",
            "//button[contains(text(), 'View More')]",
            "//a[contains(text(), 'Load More')]",
            "//button[contains(@class, 'load-more')]",
            "//button[contains(@class, 'show-more')]",
            "//*[contains(text(), 'Load More')]",
            "//*[contains(text(), 'Show More')]"
        ]
        
        load_btn = None
        for selector in load_more_selectors:
            try:
                load_btn = WebDriverWait(driver, 5).until(  # Increased wait time
                    EC.element_to_be_clickable((By.XPATH, selector))
                )
                print(f"🎯 Found load more button with selector: {selector}")
                break
            except TimeoutException:
                continue
        
        if not load_btn:
            print("📭 No more load buttons found")
            break
        
        try:
            # Scroll to button and click
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", load_btn)
            time.sleep(2)  # Increased wait time
            driver.execute_script("arguments[0].click();", load_btn)
            
            # Wait for new content with longer timeout
            print(f"⏳ Waiting for new content to load after click #{attempts + 1}...")
            time.sleep(8)  # Increased wait time significantly
            
            # Extract new organizations
            cards = driver.find_elements(By.CSS_SELECTOR, card_selector)
            new_orgs_found = extract_org_names_from_cards(cards, seen_names)
            orgs.extend(new_orgs_found)
            seen_names.update(new_orgs_found)
            
            print(f"📈 Load more #{attempts + 1}: Found {len(new_orgs_found)} new organizations (total: {len(orgs)}/1212)")
            
            if len(new_orgs_found) == 0:
                print("📭 No new organizations found, but continuing to try...")
                # Don't break immediately, try a few more times
                if attempts > 5:  # Only break after several attempts
                    break
                
        except Exception as e:
            print(f"⚠️ Error clicking load more: {e}")
            break
        
        attempts += 1

def extract_org_names_from_cards(cards, seen_names):
    """Extract organization names from a list of card elements."""
    new_orgs = []
    
    name_selectors = [
        "div[style*='font-weight: 600']",
        "h3", "h4", "h5",
        ".title", ".name", ".org-name",
        "[class*='title']", "[class*='name']",
        "strong", "b"
    ]
    
    for card in cards:
        org_name = None
        
        for name_selector in name_selectors:
            try:
                name_element = card.find_element(By.CSS_SELECTOR, name_selector)
                text = name_element.text.strip()
                if text and len(text) > 5:
                    org_name = text
                    break
            except NoSuchElementException:
                continue
        
        if not org_name:
            card_text = card.text.strip()
            if card_text:
                first_line = card_text.split('\n')[0].strip()
                if first_line and len(first_line) > 5:
                    org_name = first_line
        
        if org_name and org_name not in seen_names:
            new_orgs.append(org_name)
    
        return new_orgs

def try_infinite_scroll(driver, card_selector, orgs, seen_names):
    """Try infinite scroll to load more content."""
    print("🔘 Strategy 2: Trying infinite scroll...")
    max_scrolls = 50  # Try many scrolls
    scroll_attempts = 0
    no_new_content_count = 0
    
    while scroll_attempts < max_scrolls and no_new_content_count < 5:
        initial_count = len(orgs)
        
        # Scroll to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        print(f"📜 Scroll #{scroll_attempts + 1}, waiting for content...")
        time.sleep(6)  # Wait longer for content to load
        
        # Try extracting new organizations
        cards = driver.find_elements(By.CSS_SELECTOR, card_selector)
        new_orgs_found = extract_org_names_from_cards(cards, seen_names)
        orgs.extend(new_orgs_found)
        seen_names.update(new_orgs_found)
        
        if len(new_orgs_found) > 0:
            print(f"📈 Scroll #{scroll_attempts + 1}: Found {len(new_orgs_found)} new organizations (total: {len(orgs)}/1212)")
            no_new_content_count = 0  # Reset counter
        else:
            no_new_content_count += 1
            print(f"📭 Scroll #{scroll_attempts + 1}: No new content ({no_new_content_count}/5)")
        
        scroll_attempts += 1
        
        # Additional wait between scrolls
        time.sleep(2)

def try_aggressive_loading(driver, card_selector, orgs, seen_names):
    """Final aggressive attempt to load all content."""
    print("🔘 Strategy 3: Aggressive loading...")
    
    # Multiple scroll and wait cycles
    for i in range(10):
        print(f"🔄 Aggressive cycle #{i + 1}/10...")
        
        # Scroll to top, then to bottom
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(3)
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(8)  # Long wait
        
        # Try to trigger any lazy loading
        driver.execute_script("window.scrollBy(0, -100);")
        time.sleep(2)
        driver.execute_script("window.scrollBy(0, 100);")
        time.sleep(5)
        
        # Extract organizations
        cards = driver.find_elements(By.CSS_SELECTOR, card_selector)
        new_orgs_found = extract_org_names_from_cards(cards, seen_names)
        orgs.extend(new_orgs_found)
        seen_names.update(new_orgs_found)
        
        if len(new_orgs_found) > 0:
            print(f"🎯 Aggressive #{i + 1}: Found {len(new_orgs_found)} new organizations (total: {len(orgs)}/1212)")
        
        # If we're close to the target, keep going
        if len(orgs) >= 1000:
            print(f"🎯 Getting close! {len(orgs)}/1212 organizations found")

def save_to_excel(data, filename):
    """Save organization data to Excel file."""
    if not data:
        print("⚠️ No data to save!")
        return
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Organizations"
    ws.cell(row=1, column=1, value="Organization Name")

    for i, name in enumerate(data, start=2):
        ws.cell(row=i, column=1, value=name)

    wb.save(filename)
    print(f"💾 Saved {len(data)} organizations to {filename}")

if __name__ == "__main__":
    print("🎓 Penn State Organizations Scraper")
    print("=" * 50)
    print("🎯 Target: 1212 organizations")
    print("=" * 50)
    
    URL = "https://discover.psu.edu/organizations"
    OUTPUT_FILE = "clubs.xlsx"

    org_list = scrape_student_organizations(URL)
    
    if org_list:
        save_to_excel(org_list, OUTPUT_FILE)
        print("✅ Scraping completed successfully!")
        print(f"📊 Total organizations found: {len(org_list)}/1212 ({len(org_list)/1212*100:.1f}%)")
        
        if len(org_list) >= 1000:
            print("🎉 Excellent! Found most organizations!")
        elif len(org_list) >= 500:
            print("👍 Good! Found a substantial number of organizations")
        else:
            print("⚠️ Found fewer organizations than expected. The website might have changed or need longer wait times.")
        
        # Show first few organizations
        if len(org_list) > 0:
            print("\n📋 Sample organizations:")
            for i, org in enumerate(org_list[:10]):
                print(f"  {i+1}. {org}")
            if len(org_list) > 10:
                print(f"  ... and {len(org_list) - 10} more")
    else:
        print("❌ No organizations found. The website structure may have changed.")
        print("💡 Check the debug output above for clues about the page structure.")