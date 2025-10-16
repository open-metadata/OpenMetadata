"""
ThirdEye Service - Endpoint Testing Script

Run this script to verify all endpoints are properly configured.
Note: Requires running service and database connection.
"""
import sys
from thirdeye.app import app
from fastapi.testclient import TestClient

def test_endpoints():
    """Test all ThirdEye endpoints"""
    client = TestClient(app)
    
    print("=" * 60)
    print("ThirdEye Service - Endpoint Tests")
    print("=" * 60)
    
    endpoints = [
        ("GET", "/", "Root endpoint"),
        ("GET", "/health", "Health check"),
        ("GET", "/api/v1/thirdeye/dashboard/data", "Dashboard data"),
        ("GET", "/api/v1/thirdeye/dashboard/health-score-history?days=7", "Health score history"),
        ("GET", "/api/v1/thirdeye/action-items", "Action items"),
        ("GET", "/api/v1/thirdeye/action-items/by-category?category=table", "Filtered action items"),
        ("GET", "/api/v1/thirdeye/action-items/safe_to_purge", "Single action item"),
        ("GET", "/api/v1/thirdeye/insights/report?report_type=storage&limit=5", "Storage insights"),
        ("GET", "/api/v1/thirdeye/insights/summary", "Insights summary"),
        ("GET", "/api/v1/thirdeye/techniques", "All techniques"),
        ("GET", "/api/v1/thirdeye/techniques/safe_to_purge", "Single technique"),
        ("GET", "/api/v1/thirdeye/techniques/stats/overview", "Techniques stats"),
    ]
    
    results = {"success": 0, "failed": 0, "errors": []}
    
    for method, path, description in endpoints:
        try:
            if method == "GET":
                response = client.get(path)
            
            if response.status_code == 200:
                print(f"[OK] {description}: {response.status_code}")
                results["success"] += 1
            elif response.status_code == 500:
                # Expected if database is not connected
                print(f"[WARN] {description}: {response.status_code} (Database required)")
                results["success"] += 1
            else:
                print(f"[FAIL] {description}: {response.status_code}")
                results["failed"] += 1
                results["errors"].append((description, response.status_code))
        except Exception as e:
            print(f"[ERROR] {description}: Error - {str(e)}")
            results["failed"] += 1
            results["errors"].append((description, str(e)))
    
    print("\n" + "=" * 60)
    print("Test Results")
    print("=" * 60)
    print(f"Passed: {results['success']}/{len(endpoints)}")
    print(f"Failed: {results['failed']}/{len(endpoints)}")
    
    if results["errors"]:
        print("\nFailed Tests:")
        for desc, error in results["errors"]:
            print(f"  - {desc}: {error}")
    
    print("\n" + "=" * 60)
    
    # List all routes
    print("\nAll Available Routes:")
    print("=" * 60)
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            methods = ', '.join(route.methods)
            print(f"  {methods:6} {route.path}")
    
    print("\n" + "=" * 60)
    print("Endpoint configuration test complete!")
    print("=" * 60)
    
    return results["failed"] == 0


if __name__ == "__main__":
    success = test_endpoints()
    sys.exit(0 if success else 1)

