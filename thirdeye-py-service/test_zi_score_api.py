"""Test script for ZI Score API endpoints.

This script demonstrates how to interact with the ZI Score API
and can be used for manual testing and verification.

Usage:
    python test_zi_score_api.py

Requirements:
    - thirdeye-py-service running on localhost:8586
    - Valid JWT token from OpenMetadata
    - Data in fact_datalake_table_usage_inventory table
"""

import asyncio
import httpx
from typing import Dict, Any
import json


# Configuration
BASE_URL = "http://localhost:8586"
# Replace with your actual JWT token from OpenMetadata
JWT_TOKEN = "YOUR_JWT_TOKEN_HERE"


class ZIScoreAPITester:
    """Test client for ZI Score API."""
    
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}"
        } if token != "YOUR_JWT_TOKEN_HERE" else {}
    
    async def test_health(self) -> bool:
        """Test basic health endpoint."""
        print("\n=== Testing Health Endpoint ===")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/v1/thirdeye/health")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
            return response.status_code == 200
    
    async def test_zi_score(self) -> Dict[str, Any]:
        """Test full ZI Score endpoint."""
        print("\n=== Testing ZI Score (Full) ===")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/thirdeye/zi-score",
                headers=self.headers
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Overall Score: {data.get('overall', 'N/A')}")
            print(f"Status: {data.get('status', 'N/A')}")
            print(f"Trend: {data.get('trend', 'N/A')}")
            
            if 'breakdown' in data:
                print("\nBreakdown:")
                for component, value in data['breakdown'].items():
                    print(f"  {component}: {value}")
            
            if 'metadata' in data:
                meta = data['metadata']
                print(f"\nKey Metrics:")
                print(f"  Total Tables: {meta.get('totalTables', 'N/A')}")
                print(f"  Active Tables: {meta.get('activeTables', 'N/A')}")
                print(f"  Waste Storage (TB): {meta.get('wasteStorageTB', 'N/A')}")
                print(f"  Annual Savings Opportunity: ${meta.get('annualSavingsOpportunityUSD', 'N/A'):.2f}")
            
            return data
    
    async def test_zi_score_summary(self) -> Dict[str, Any]:
        """Test ZI Score summary endpoint."""
        print("\n=== Testing ZI Score Summary ===")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/thirdeye/zi-score/summary",
                headers=self.headers
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Score: {data.get('score', 'N/A')}")
            print(f"Status: {data.get('status', 'N/A')}")
            
            if 'savings' in data:
                print(f"Monthly Savings Opportunity: ${data['savings'].get('monthly', 'N/A'):.2f}")
                print(f"Annual Savings Opportunity: ${data['savings'].get('annual', 'N/A'):.2f}")
            
            return data
    
    async def test_health_metrics(self) -> Dict[str, Any]:
        """Test raw health metrics endpoint."""
        print("\n=== Testing Raw Health Metrics ===")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/thirdeye/zi-score/health-metrics",
                headers=self.headers
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            
            if 'health_score' in data:
                print(f"Health Score: {data['health_score']}")
                print(f"Utilization Rate: {data.get('utilization_rate', 'N/A')}%")
                print(f"Storage Efficiency: {data.get('storage_efficiency', 'N/A')}%")
                print(f"Access Freshness: {data.get('access_freshness', 'N/A')}%")
            else:
                print(f"Response: {data}")
            
            return data
    
    async def test_purge_candidates(self, limit: int = 10, min_score: float = None) -> Dict[str, Any]:
        """Test purge candidates endpoint."""
        print(f"\n=== Testing Purge Candidates (limit={limit}, min_score={min_score}) ===")
        
        params = {"limit": limit}
        if min_score is not None:
            params["min_score"] = min_score
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/thirdeye/zi-score/purge-candidates",
                headers=self.headers,
                params=params
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            
            if 'data' in data:
                print(f"Found {len(data['data'])} candidates")
                
                if data['data']:
                    print("\nTop Candidates:")
                    for i, candidate in enumerate(data['data'][:5], 1):
                        print(f"\n  {i}. {candidate['fqn']}")
                        print(f"     Score: {candidate['purge_score']:.1f}")
                        print(f"     Recommendation: {candidate['recommendation']}")
                        print(f"     Size: {candidate['size_gb']:.2f} GB")
                        print(f"     Days Since Access: {candidate.get('days_since_access', 'N/A')}")
                        print(f"     Annual Savings: ${candidate['annual_savings_usd']:.2f}")
            else:
                print(f"Response: {data}")
            
            return data
    
    async def test_graphql(self) -> Dict[str, Any]:
        """Test GraphQL endpoint."""
        print("\n=== Testing GraphQL Endpoint ===")
        
        query = """
        query {
          ziScore {
            overall
            status
            trend
            breakdown {
              storage
              compute
              query
              others
            }
            metadata {
              totalTables
              activeTables
              annualSavingsOpportunityUsd
            }
          }
        }
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/thirdeye/graphql",
                headers={**self.headers, "Content-Type": "application/json"},
                json={"query": query}
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            
            if 'data' in data and 'ziScore' in data['data']:
                zi_score = data['data']['ziScore']
                print(f"Overall Score: {zi_score['overall']}")
                print(f"Status: {zi_score['status']}")
                print(f"Trend: {zi_score['trend']}")
                print(f"\nBreakdown:")
                for component, value in zi_score['breakdown'].items():
                    print(f"  {component}: {value}")
            else:
                print(f"Response: {json.dumps(data, indent=2)}")
            
            return data
    
    async def run_all_tests(self):
        """Run all API tests."""
        print("=" * 60)
        print("ZI Score API Test Suite")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Auth: {'Enabled' if self.headers else 'Disabled (no token)'}")
        
        try:
            # Test health
            await self.test_health()
            
            # If no auth token, skip authenticated endpoints
            if not self.headers:
                print("\n⚠️  No JWT token provided. Skipping authenticated endpoints.")
                print("Set JWT_TOKEN variable to test authenticated endpoints.")
                return
            
            # Test all authenticated endpoints
            await self.test_zi_score()
            await self.test_zi_score_summary()
            await self.test_health_metrics()
            await self.test_purge_candidates(limit=5, min_score=8.0)
            await self.test_graphql()
            
            print("\n" + "=" * 60)
            print("✅ All tests completed!")
            print("=" * 60)
            
        except httpx.ConnectError:
            print("\n❌ Error: Could not connect to thirdeye-py-service")
            print(f"Please ensure the service is running at {self.base_url}")
        except Exception as e:
            print(f"\n❌ Error during testing: {e}")
            import traceback
            traceback.print_exc()


async def main():
    """Main test runner."""
    tester = ZIScoreAPITester(BASE_URL, JWT_TOKEN)
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())

