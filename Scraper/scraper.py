from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import openpyxl

def scrape_student_organizations(url, driver_path=None):
    # Initialize WebDriver
    if driver_path:
        driver = webdriver.Chrome(executable_path=driver_path)
    else:
        driver = webdriver.Chrome()
    driver.get(url)

    orgs = []
    seen_names = set()

    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".MuiCard-root"))
        )

        while True:
            cards = driver.find_elements(By.CSS_SELECTOR, ".MuiCard-root")
            for card in cards:
                try:
                    name = card.find_element(By.CSS_SELECTOR, "div[style*='font-weight: 600']").text.strip()
                    if name and name not in seen_names:
                        orgs.append(name)
                        seen_names.add(name)
                except:
                    continue

            print(f"Collected {len(orgs)} organizations so far.")

            try:
                load_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[.//span[contains(text(), 'Load More')]]"))
                )
                print("Load More button found. Attempting to click...")
                driver.execute_script("arguments[0].scrollIntoView(true);", load_btn)
                time.sleep(0.5)

                prev_count = len(driver.find_elements(By.CSS_SELECTOR, ".MuiCard-root"))
                driver.execute_script("arguments[0].click();", load_btn)

                WebDriverWait(driver, 15).until(
                    lambda d: len(d.find_elements(By.CSS_SELECTOR, ".MuiCard-root")) > prev_count
                )
                print("Clicked Load More and new cards appeared.")

            except Exception as e:
                print(f"Load More button not found or not clickable: {e}")
                driver.save_screenshot(f"load_more_failure_{len(orgs)}.png")
                break

        # 🔁 Final sweep to catch any last cards not scraped yet
        cards = driver.find_elements(By.CSS_SELECTOR, ".MuiCard-root")
        for card in cards:
            try:
                name = card.find_element(By.CSS_SELECTOR, "div[style*='font-weight: 600']").text.strip()
                if name and name not in seen_names:
                    orgs.append(name)
                    seen_names.add(name)
            except:
                continue

    finally:
        driver.quit()

    return orgs


def save_to_excel(data, filename):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Organizations"
    ws.cell(row=1, column=1, value="Organization Name")

    for i, name in enumerate(data, start=2):
        ws.cell(row=i, column=1, value=name)

    wb.save(filename)
    print(f"Saved {len(data)} organizations to {filename}")

if __name__ == "__main__":
    URL = "https://orgcentral.psu.edu/organizations"
    DRIVER_PATH = None  # or "path/to/chromedriver"
    OUTPUT_FILE = "/Users/msalau/Desktop/PSU_Student_Organizations.xlsx"

    org_list = scrape_student_organizations(URL, DRIVER_PATH)
    save_to_excel(org_list, OUTPUT_FILE)