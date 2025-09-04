import requests
import json
import re
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
from typing import Dict, List, Any, Optional

class HexDashboardExtractor:
    """
    Complete solution for extracting Hex dashboard data when no API calls are visible
    """
    
    def __init__(self, session_cookies: str):
        self.session_cookies = session_cookies
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.8',
            'Cookie': session_cookies
        }
    
    def extract_from_html(self, dashboard_url: str) -> Dict[str, Any]:
        """
        Method 1: Extract dashboard data embedded in HTML
        """
        print("🔍 Method 1: Extracting data from HTML...")
        
        response = requests.get(dashboard_url, headers=self.headers)
        
        if response.status_code != 200:
            raise Exception(f"Failed to fetch dashboard: {response.status_code}")
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for embedded data in script tags
        dashboard_data = {
            "project_config": None,
            "cells_data": None,
            "analytics_data": None,
            "app_state": None
        }
        
        # Search for common data patterns in script tags
        scripts = soup.find_all('script')
        
        for script in scripts:
            if script.string:
                script_content = script.string
                
                # Look for project configuration
                if 'projectConfig' in script_content or 'project_config' in script_content:
                    dashboard_data["project_config"] = self._extract_json_from_script(
                        script_content, ['projectConfig', 'project_config', 'PROJECT_CONFIG']
                    )
                
                # Look for cells/charts data
                if 'cells' in script_content or 'widgets' in script_content:
                    dashboard_data["cells_data"] = self._extract_json_from_script(
                        script_content, ['cells', 'widgets', 'components', 'chartConfigs']
                    )
                
                # Look for analytics data
                if 'analytics' in script_content or 'usage' in script_content:
                    dashboard_data["analytics_data"] = self._extract_json_from_script(
                        script_content, ['analytics', 'usage', 'metrics']
                    )
                
                # Look for app state
                if 'appState' in script_content or 'initialState' in script_content:
                    dashboard_data["app_state"] = self._extract_json_from_script(
                        script_content, ['appState', 'initialState', 'state']
                    )
        
        return self._clean_extracted_data(dashboard_data)
    
    def _extract_json_from_script(self, script_content: str, possible_keys: List[str]) -> Optional[Dict]:
        """Extract JSON data from script content"""
        
        for key in possible_keys:
            # Look for patterns like: var projectConfig = {...}
            pattern = rf'{key}\s*[=:]\s*(\{{.*?\}});?'
            match = re.search(pattern, script_content, re.DOTALL)
            
            if match:
                try:
                    json_str = match.group(1)
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    continue
            
            # Look for patterns like: window.PROJECT_CONFIG = {...}
            pattern = rf'window\.{key}\s*=\s*(\{{.*?\}});?'
            match = re.search(pattern, script_content, re.DOTALL)
            
            if match:
                try:
                    json_str = match.group(1)
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    continue
        
        return None
    
    def extract_with_selenium(self, dashboard_url: str) -> Dict[str, Any]:
        """
        Method 2: Use Selenium to capture dynamic API calls and page data
        """
        print("🔍 Method 2: Using Selenium to capture dynamic content...")
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # Run in background
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        # Enable logging
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        
        driver = webdriver.Chrome(options=chrome_options)
        
        try:
            # Set cookies
            driver.get("https://app.hex.tech")
            self._set_cookies_from_string(driver, self.session_cookies)
            
            # Enable network logging
            driver.execute_cdp_cmd('Network.enable', {})
            
            # Navigate to dashboard
            print(f"📄 Loading dashboard: {dashboard_url}")
            driver.get(dashboard_url)
            
            # Wait for page to fully load
            WebDriverWait(driver, 30).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            
            # Wait for additional content to load
            time.sleep(5)
            
            # Try to trigger API calls by interacting with the page
            self._trigger_dashboard_interactions(driver)
            
            # Get network logs
            logs = driver.get_log('performance')
            api_calls = self._extract_api_calls_from_logs(logs)
            
            # Extract data from page JavaScript
            page_data = self._extract_data_from_page_js(driver)
            
            # Extract data from DOM elements
            dom_data = self._extract_data_from_dom(driver)
            
            return {
                "api_calls_discovered": api_calls,
                "page_javascript_data": page_data,
                "dom_extracted_data": dom_data,
                "page_source": driver.page_source[:1000] + "..." if len(driver.page_source) > 1000 else driver.page_source
            }
            
        finally:
            driver.quit()
    
    def _set_cookies_from_string(self, driver, cookie_string: str):
        """Set cookies from cURL cookie string"""
        
        # Parse cookie string from cURL
        cookies = {}
        for cookie_pair in cookie_string.split(';'):
            if '=' in cookie_pair:
                key, value = cookie_pair.strip().split('=', 1)
                # URL decode
                import urllib.parse
                cookies[key] = urllib.parse.unquote(value)
        
        # Set each cookie
        for name, value in cookies.items():
            try:
                driver.add_cookie({'name': name, 'value': value, 'domain': '.hex.tech'})
            except Exception as e:
                print(f"Warning: Could not set cookie {name}: {e}")
    
    def _trigger_dashboard_interactions(self, driver):
        """Trigger interactions that might load additional data"""
        
        try:
            # Scroll page to trigger lazy loading
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Look for and click interactive elements
            clickable_elements = driver.find_elements(By.CSS_SELECTOR, 
                '[role="button"], .btn, button, [data-testid*="chart"], [data-testid*="widget"]')
            
            for element in clickable_elements[:5]:  # Try first 5 elements
                try:
                    driver.execute_script("arguments[0].click();", element)
                    time.sleep(1)
                except Exception:
                    pass
            
            # Try date range selectors or filters
            date_selectors = driver.find_elements(By.CSS_SELECTOR, 
                '[data-testid*="date"], [data-testid*="filter"], select, input[type="date"]')
            
            for selector in date_selectors[:3]:
                try:
                    driver.execute_script("arguments[0].click();", selector)
                    time.sleep(1)
                except Exception:
                    pass
                    
        except Exception as e:
            print(f"Warning during interaction: {e}")
    
    def _extract_api_calls_from_logs(self, logs: List[Dict]) -> List[Dict]:
        """Extract API calls from Chrome performance logs"""
        
        api_calls = []
        
        for log_entry in logs:
            try:
                message = json.loads(log_entry['message'])
                
                if message['message']['method'] == 'Network.responseReceived':
                    response = message['message']['params']['response']
                    url = response['url']
                    
                    # Look for API endpoints
                    if '/api/' in url and any(term in url for term in ['project', 'cell', 'chart', 'analytics']):
                        api_calls.append({
                            'url': url,
                            'method': response.get('method', 'GET'),
                            'status': response.get('status'),
                            'headers': response.get('headers', {}),
                            'timestamp': log_entry['timestamp']
                        })
                        
            except (json.JSONDecodeError, KeyError):
                continue
        
        return api_calls
    
    def _extract_data_from_page_js(self, driver) -> Dict[str, Any]:
        """Extract data from JavaScript variables in the page"""
        
        page_data = {}
        
        # Common JavaScript variables that might contain dashboard data
        js_variables = [
            'window.projectData',
            'window.dashboardConfig', 
            'window.initialState',
            'window.appState',
            'window.hexData',
            'window.__INITIAL_STATE__',
            'window.__PROJECT_CONFIG__'
        ]
        
        for var_name in js_variables:
            try:
                result = driver.execute_script(f"return {var_name};")
                if result:
                    page_data[var_name.replace('window.', '')] = result
            except Exception:
                continue
        
        # Try to find React/Vue component data
        try:
            react_data = driver.execute_script("""
                // Look for React components with dashboard data
                const reactFiber = document.querySelector('[data-reactroot]')?._reactInternalFiber;
                if (reactFiber) {
                    return reactFiber.memoizedProps || reactFiber.pendingProps;
                }
                return null;
            """)
            if react_data:
                page_data['react_component_data'] = react_data
        except Exception:
            pass
        
        return page_data
    
    def _extract_data_from_dom(self, driver) -> Dict[str, Any]:
        """Extract data from DOM elements"""
        
        dom_data = {
            "charts": [],
            "tables": [],
            "kpis": [],
            "filters": []
        }
        
        try:
            # Look for chart containers
            chart_elements = driver.find_elements(By.CSS_SELECTOR, 
                '[data-testid*="chart"], .chart, [class*="chart"], canvas, svg')
            
            for i, chart in enumerate(chart_elements):
                try:
                    chart_info = {
                        "id": f"chart_{i}",
                        "element_type": chart.tag_name,
                        "classes": chart.get_attribute('class'),
                        "data_attributes": {attr: chart.get_attribute(attr) for attr in chart.get_property('attributes') if attr.startswith('data-')},
                        "position": chart.location,
                        "size": chart.size,
                        "text_content": chart.text[:200] if chart.text else None
                    }
                    dom_data["charts"].append(chart_info)
                except Exception:
                    pass
            
            # Look for tables
            table_elements = driver.find_elements(By.CSS_SELECTOR, 'table, [role="table"], [data-testid*="table"]')
            
            for i, table in enumerate(table_elements):
                try:
                    table_info = {
                        "id": f"table_{i}",
                        "rows": len(table.find_elements(By.TAG_NAME, 'tr')),
                        "columns": len(table.find_elements(By.TAG_NAME, 'th')) or len(table.find_elements(By.TAG_NAME, 'td')),
                        "headers": [th.text for th in table.find_elements(By.TAG_NAME, 'th')],
                        "sample_data": [td.text for td in table.find_elements(By.TAG_NAME, 'td')[:10]]
                    }
                    dom_data["tables"].append(table_info)
                except Exception:
                    pass
            
            # Look for KPI/metric elements
            kpi_elements = driver.find_elements(By.CSS_SELECTOR, 
                '[data-testid*="metric"], [data-testid*="kpi"], .metric, .kpi, [class*="stat"]')
            
            for i, kpi in enumerate(kpi_elements):
                try:
                    kpi_info = {
                        "id": f"kpi_{i}",
                        "text": kpi.text,
                        "value": re.findall(r'[\d,]+(?:\.\d+)?', kpi.text),
                        "position": kpi.location
                    }
                    dom_data["kpis"].append(kpi_info)
                except Exception:
                    pass
                    
        except Exception as e:
            print(f"DOM extraction error: {e}")
        
        return dom_data
    
    def _clean_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and structure extracted data"""
        
        cleaned = {}
        
        for key, value in data.items():
            if value is not None:
                cleaned[key] = value
        
        return cleaned
    
    def extract_via_browser_console(self, dashboard_url: str) -> str:
        """
        Method 3: Generate JavaScript code to run in browser console
        """
        
        console_script = f"""
// ========================================
// Hex Dashboard Data Extraction Script
// Run this in Chrome Console on your dashboard page
// ========================================

console.log('🔍 Starting Hex Dashboard Data Extraction...');

// Project ID
const projectId = '{dashboard_url.split("/")[-1] if "/" in dashboard_url else "unknown"}';
console.log('📊 Project ID:', projectId);

// ========================================
// Method 1: Extract from Global Variables
// ========================================
console.log('\\n🔍 Method 1: Checking global variables...');

const globalVars = [
    'projectData', 'dashboardConfig', 'initialState', 'appState', 
    'hexData', '__INITIAL_STATE__', '__PROJECT_CONFIG__',
    '__NEXT_DATA__', '__APP_DATA__'
];

const foundGlobalData = {{}};

globalVars.forEach(varName => {{
    if (window[varName]) {{
        console.log(`✅ Found: window.${{varName}}`);
        foundGlobalData[varName] = window[varName];
    }}
}});

// ========================================
// Method 2: Extract from React/Vue Components
// ========================================
console.log('\\n🔍 Method 2: Checking React components...');

let reactData = null;
try {{
    // Find React components
    const reactElement = document.querySelector('[data-reactroot]') || 
                        document.querySelector('#root') ||
                        document.querySelector('#app');
    
    if (reactElement && reactElement._reactInternalFiber) {{
        console.log('✅ Found React component');
        reactData = reactElement._reactInternalFiber.memoizedProps;
    }} else if (reactElement && reactElement._reactInternalInstance) {{
        console.log('✅ Found React component (legacy)');
        reactData = reactElement._reactInternalInstance._currentElement.props;
    }}
}} catch (e) {{
    console.log('❌ React extraction failed:', e);
}}

// ========================================
// Method 3: Extract from DOM Data Attributes
// ========================================
console.log('\\n🔍 Method 3: Checking DOM data attributes...');

const elementsWithData = document.querySelectorAll('[data-config], [data-chart], [data-widget], [data-project]');
const domData = [];

elementsWithData.forEach((el, index) => {{
    const dataAttrs = {{}};
    for (let attr of el.attributes) {{
        if (attr.name.startsWith('data-')) {{
            try {{
                // Try to parse as JSON
                dataAttrs[attr.name] = JSON.parse(attr.value);
            }} catch {{
                dataAttrs[attr.name] = attr.value;
            }}
        }}
    }}
    
    if (Object.keys(dataAttrs).length > 0) {{
        domData.push({{
            element: el.tagName,
            id: el.id,
            classes: el.className,
            dataAttributes: dataAttrs,
            textContent: el.textContent.substring(0, 100)
        }});
    }}
}});

console.log(`✅ Found ${{domData.length}} elements with data attributes`);

// ========================================
// Method 4: Monitor Network Requests
// ========================================
console.log('\\n🔍 Method 4: Setting up network monitoring...');

const networkCalls = [];
const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest;

// Override fetch
window.fetch = function(...args) {{
    const url = args[0];
    if (typeof url === 'string' && url.includes('api')) {{
        console.log('🌐 Fetch API call:', url);
        networkCalls.push({{type: 'fetch', url: url, timestamp: Date.now()}});
    }}
    return originalFetch.apply(this, args);
}};

// Override XMLHttpRequest
window.XMLHttpRequest = function() {{
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    
    xhr.open = function(method, url) {{
        if (url.includes('api')) {{
            console.log('🌐 XHR call:', method, url);
            networkCalls.push({{type: 'xhr', method: method, url: url, timestamp: Date.now()}});
        }}
        return originalOpen.apply(this, arguments);
    }};
    
    return xhr;
}};

// ========================================
// Method 5: Extract Chart Configurations
// ========================================
console.log('\\n🔍 Method 5: Looking for chart configurations...');

const chartElements = document.querySelectorAll('canvas, svg, [class*="chart"], [data-testid*="chart"]');
const chartConfigs = [];

chartElements.forEach((chart, index) => {{
    try {{
        // Try to find associated data
        const parentElement = chart.closest('[data-config], [data-chart-config]');
        const config = parentElement ? parentElement.dataset : {{}};
        
        chartConfigs.push({{
            id: `chart_${{index}}`,
            type: chart.tagName.toLowerCase(),
            position: chart.getBoundingClientRect(),
            classes: chart.className,
            config: config,
            title: chart.getAttribute('title') || chart.getAttribute('aria-label')
        }});
    }} catch (e) {{
        console.log(`Warning: Could not extract chart ${{index}}:`, e);
    }}
}});

console.log(`✅ Found ${{chartConfigs.length}} chart elements`);

// ========================================
// Compile Results
// ========================================
const extractedData = {{
    projectId: projectId,
    extractionTime: new Date().toISOString(),
    globalVariables: foundGlobalData,
    reactData: reactData,
    domData: domData,
    chartConfigs: chartConfigs,
    networkCalls: networkCalls
}};

console.log('\\n📊 ========== EXTRACTION COMPLETE ==========');
console.log('📋 Copy this data:');
console.log(JSON.stringify(extractedData, null, 2));

// Also save to global variable for easy access
window.extractedDashboardData = extractedData;
console.log('\\n💾 Data saved to: window.extractedDashboardData');
console.log('\\n🔄 To refresh monitoring, reload page and run script again');

// Return the data
extractedData;
"""
        
        return console_script
    
    def _extract_api_calls_from_logs(self, logs: List[Dict]) -> List[Dict]:
        """Extract API calls from browser performance logs"""
        
        api_calls = []
        
        for log_entry in logs:
            try:
                message = json.loads(log_entry['message'])
                
                if message['message']['method'] == 'Network.responseReceived':
                    response = message['message']['params']['response']
                    url = response['url']
                    
                    # Filter for relevant API calls
                    if '/api/' in url and any(term in url for term in ['project', 'cell', 'chart', 'dashboard']):
                        api_calls.append({
                            'url': url,
                            'method': response.get('method', 'GET'),
                            'status': response.get('status'),
                            'mime_type': response.get('mimeType'),
                            'timestamp': log_entry['timestamp']
                        })
                        
            except (json.JSONDecodeError, KeyError):
                continue
        
        return api_calls

# ========================================
# Method 4: Interactive API Discovery
# ========================================

def interactive_hex_discovery(dashboard_url: str, session_cookies: str):
    """
    Interactive discovery - guides user through finding APIs
    """
    
    print("🎯 INTERACTIVE HEX API DISCOVERY")
    print("=" * 50)
    print(f"Dashboard URL: {dashboard_url}")
    print(f"Session Cookies: {session_cookies[:50]}...")
    print()
    
    print("📋 STEP 1: Browser Console Method")
    print("-" * 30)
    print("1. Open your dashboard in Chrome:")
    print(f"   {dashboard_url}")
    print()
    print("2. Open Developer Tools (F12) → Console tab")
    print()
    print("3. Paste and run this script:")
    print()
    
    extractor = HexDashboardExtractor(session_cookies)
    console_script = extractor.extract_via_browser_console(dashboard_url)
    
    print("```javascript")
    print(console_script)
    print("```")
    print()
    
    print("📋 STEP 2: Network Monitoring")
    print("-" * 30)
    print("1. Keep DevTools open → Network tab")
    print("2. Check 'XHR' and 'Fetch' filters")
    print("3. Interact with your dashboard:")
    print("   - Click charts/filters")
    print("   - Change date ranges")
    print("   - Hover over elements")
    print("4. Look for new API requests that appear")
    print("5. Copy promising requests as cURL")
    print()
    
    print("📋 STEP 3: Alternative - Selenium Extraction")
    print("-" * 30)
    print("Run this Python code to automate extraction:")
    print()
    print("```python")
    print(f"extractor = HexDashboardExtractor('{session_cookies}')")
    print(f"data = extractor.extract_with_selenium('{dashboard_url}')")
    print("print(json.dumps(data, indent=2))")
    print("```")

# ========================================
# Usage Examples
# ========================================

def main():
    """Main function demonstrating all extraction methods"""
    
    # Your data from cURL
    dashboard_url = "https://app.hex.tech/01990428-c63b-7004-97d2-8c21296d323b/app/Test-Dashboard-for-ingestion-030v961MZ8kUEsgqRwLmeq/latest"
    session_cookies = "rl_anonymous_id=%2232812371-bb2a-4339-9271-fcdd692d400e%22; connect.sid=s%3AdPhdIljRL4TCSGdtXoSYoRQaXJjhmLR0.5h%2BynCLZPuJecgfmW3UhQbVVZP9b%2FwtCiuPQXnODiGw; rl_user_id=%2201990428-c63b-7004-97d2-9145a07fbc91%22"
    
    print("🚀 HEX DASHBOARD DATA EXTRACTION")
    print("=" * 50)
    
    # Initialize extractor
    extractor = HexDashboardExtractor(session_cookies)
    
    # Method 1: Extract from HTML
    try:
        print("\\n🔍 Trying HTML extraction...")
        html_data = extractor.extract_from_html(dashboard_url)
        print("✅ HTML Extraction Results:")
        for key, value in html_data.items():
            if value:
                print(f"   {key}: Found data")
            else:
                print(f"   {key}: No data")
    except Exception as e:
        print(f"❌ HTML extraction failed: {e}")
    
    # Method 2: Interactive discovery guide
    print("\\n" + "=" * 50)
    interactive_hex_discovery(dashboard_url, session_cookies)

if __name__ == "__main__":
    main()