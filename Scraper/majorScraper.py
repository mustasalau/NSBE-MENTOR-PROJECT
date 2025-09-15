from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import os
import json
import time

URL = "https://www.psu.edu/academics/undergraduate/majors"

def create_driver():
    options = webdriver.ChromeOptions()
    # Headless in CI
    if os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS'):
        options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    # Let Selenium Manager resolve the proper driver
    return webdriver.Chrome(options=options)

def scrape_psu_majors():
    driver = create_driver()
    driver.get(URL)

    majors = []
    try:
        while True:
            WebDriverWait(driver, 15).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "[data-tracking-id='MajorCard']"))
            )

            cards = driver.find_elements(By.CSS_SELECTOR, "[data-tracking-id='MajorCard'] h4")
            page_majors = [el.text.strip() for el in cards if el.text.strip()]
            majors.extend(page_majors)

            try:
                next_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-tracking-id='MajorListing-Pagination-NextButton']"))
                )
                if next_button.get_attribute("aria-disabled") == "true":
                    break
                ActionChains(driver).move_to_element(next_button).click().perform()
                time.sleep(2)
            except Exception:
                break
    finally:
        driver.quit()

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for m in majors:
        if m not in seen:
            seen.add(m)
            unique.append(m)

    # Write to expected merge output
    output_file = 'penn_state_majors.json'
    with open(output_file, 'w') as f:
        json.dump(unique, f, indent=2)

    print(f"✅ Saved {len(unique)} majors to {output_file}")

if __name__ == '__main__':
    scrape_psu_majors()