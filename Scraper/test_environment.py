#!/usr/bin/env python3
"""
Environment Test Script
Run this locally and in CI to compare differences
"""

import json
import os
import platform
import subprocess
import sys

def test_requests_simple():
    """Test simple HTTP request to the target site."""
    try:
        import requests
        print("🌐 Testing simple HTTP request...")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        response = requests.get('https://discover.psu.edu/organizations', headers=headers, timeout=30)
        print(f"  Status: {response.status_code}")
        print(f"  Response length: {len(response.text)} characters")
        
        # Look for organization links
        import re
        org_links = re.findall(r'href="[^"]*?/organization/([^"]*?)"', response.text)
        print(f"  Organization links found: {len(set(org_links))}")
        
        # Sample the first few
        unique_links = list(set(org_links))[:5]
        print(f"  Sample links: {unique_links}")
        
        return len(set(org_links)) > 0
        
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        return False

def test_chrome_minimal():
    """Test minimal Chrome setup."""
    try:
        print("🌎 Testing minimal Chrome...")
        
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        # Try to find Chrome binary
        chrome_paths = ['/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium']
        chrome_binary = None
        for path in chrome_paths:
            if os.path.exists(path):
                chrome_binary = path
                break
                
        if chrome_binary:
            chrome_options.binary_location = chrome_binary
            print(f"  Using Chrome binary: {chrome_binary}")
        
        driver = webdriver.Chrome(options=chrome_options)
        driver.get('https://httpbin.org/get')
        
        # Get page title to confirm it works
        title = driver.title
        print(f"  ✅ Chrome working - Page title: {title}")
        
        driver.quit()
        return True
        
    except Exception as e:
        print(f"  ❌ Chrome failed: {e}")
        return False

def main():
    print("🧪 ENVIRONMENT TEST SCRIPT")
    print("=" * 50)
    
    # Basic environment info
    print(f"🖥️  OS: {platform.system()} {platform.release()}")
    print(f"🖥️  Python: {platform.python_version()}")
    print(f"🌍 CI: {os.environ.get('CI', 'false')}")
    print(f"🌍 GitHub Actions: {os.environ.get('GITHUB_ACTIONS', 'false')}")
    
    print("\n" + "=" * 50)
    
    # Test results
    results = {}
    
    # Test 1: Simple HTTP request
    results['requests'] = test_requests_simple()
    
    # Test 2: Chrome only (Firefox removed)
    results['chrome'] = test_chrome_minimal()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY:")
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {test_name.capitalize()}: {status}")
    
    # Environment-specific recommendations
    print("\n💡 RECOMMENDATIONS:")
    if results['requests']:
        print("  ✅ HTTP requests work - use requests-based approach!")
    else:
        print("  ⚠️  HTTP requests failed - may need browser automation")
        
    if results['chrome']:
        print("  ✅ Chrome works - using Chrome WebDriver")
    else:
        print("  ❌ Chrome not working - investigate browser installation")

if __name__ == "__main__":
    main() 