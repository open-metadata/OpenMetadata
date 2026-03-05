#!/usr/bin/env python3
# Copyright 2026 Collate.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
Script to create sample glossaries with terms and relationships.
Run against a local OpenMetadata instance.

Usage:
    python create_sample_glossaries.py [--base-url http://localhost:8585]
"""

import requests
import json
import argparse
import sys
from typing import Optional

class OpenMetadataClient:
    def __init__(self, base_url: str, token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/v1"
        self.headers = {"Content-Type": "application/json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def create_glossary(self, name: str, display_name: str, description: str) -> dict:
        """Create a glossary"""
        data = {
            "name": name,
            "displayName": display_name,
            "description": description
        }
        resp = requests.post(f"{self.api_url}/glossaries", json=data, headers=self.headers)
        if resp.status_code == 409:
            # Already exists, get it
            resp = requests.get(f"{self.api_url}/glossaries/name/{name}", headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def create_term(self, glossary_name: str, name: str, display_name: str, description: str) -> dict:
        """Create a glossary term"""
        data = {
            "glossary": glossary_name,
            "name": name,
            "displayName": display_name,
            "description": description
        }
        resp = requests.post(f"{self.api_url}/glossaryTerms", json=data, headers=self.headers)
        if resp.status_code == 409:
            fqn = f"{glossary_name}.{name}"
            resp = requests.get(f"{self.api_url}/glossaryTerms/name/{fqn}", headers=self.headers)
        if resp.status_code not in [200, 201]:
            print(f"    Warning: Could not create term {name}: {resp.status_code} - {resp.text[:200]}")
            return None
        return resp.json()

    def add_relation(self, term_id: str, related_term_id: str, relation_type: str):
        """Add a relationship between two terms"""
        # Get current term to check existing relations
        term_resp = requests.get(f"{self.api_url}/glossaryTerms/{term_id}?fields=relatedTerms", headers=self.headers)
        term_resp.raise_for_status()

        patch_data = [
            {
                "op": "add",
                "path": "/relatedTerms/-",
                "value": {
                    "term": {
                        "id": related_term_id,
                        "type": "glossaryTerm"
                    },
                    "relationType": relation_type
                }
            }
        ]

        headers = {**self.headers, "Content-Type": "application/json-patch+json"}
        resp = requests.patch(f"{self.api_url}/glossaryTerms/{term_id}", json=patch_data, headers=headers)
        if resp.status_code not in [200, 201]:
            print(f"  Warning: Could not add relation {relation_type}: {resp.text[:100]}")
        return resp


def main():
    parser = argparse.ArgumentParser(description="Create sample glossaries")
    parser.add_argument("--base-url", default="http://localhost:8585", help="OpenMetadata base URL")
    parser.add_argument("--token", default=None, help="Auth token (optional)")
    args = parser.parse_args()

    client = OpenMetadataClient(args.base_url, args.token)

    print("=" * 60)
    print("Creating Sample Glossaries with Real-World Examples")
    print("=" * 60)

    # ========================================
    # 1. Finance Glossary
    # ========================================
    print("\n[1/3] Creating Finance Glossary...")
    finance = client.create_glossary(
        "FinanceGlossary",
        "Finance Glossary",
        "Financial metrics, KPIs, and business terminology for measuring company performance"
    )
    finance_name = finance['name']
    print(f"  Created: Finance Glossary ({finance_name})")

    # Finance terms
    finance_terms = {}
    terms_data = [
        ("Revenue", "Revenue", "Total income generated from sales of goods or services before any expenses are deducted"),
        ("GrossRevenue", "Gross Revenue", "Total revenue before deducting returns, allowances, and discounts"),
        ("NetRevenue", "Net Revenue", "Revenue after deducting returns, allowances, and discounts"),
        ("Cost", "Cost", "Expenses incurred in producing goods or services"),
        ("COGS", "Cost of Goods Sold", "Direct costs attributable to the production of goods sold by a company"),
        ("OperatingExpenses", "Operating Expenses", "Expenses required for day-to-day business operations excluding COGS"),
        ("Profit", "Profit", "Financial gain after deducting all expenses from revenue"),
        ("GrossProfit", "Gross Profit", "Revenue minus cost of goods sold"),
        ("NetProfit", "Net Profit", "Total profit after all expenses, taxes, and costs have been deducted"),
        ("GrossMargin", "Gross Margin", "Gross profit as a percentage of revenue"),
        ("NetMargin", "Net Margin", "Net profit as a percentage of revenue"),
        ("EBITDA", "EBITDA", "Earnings Before Interest, Taxes, Depreciation, and Amortization"),
    ]

    for name, display_name, description in terms_data:
        term = client.create_term(finance_name, name, display_name, description)
        if term:
            finance_terms[name] = term['id']
            print(f"    - {display_name}")

    # ========================================
    # 2. Sales Glossary
    # ========================================
    print("\n[2/3] Creating Sales Glossary...")
    sales = client.create_glossary(
        "SalesGlossary",
        "Sales Glossary",
        "Sales metrics, pipeline terminology, and customer lifecycle stages"
    )
    sales_name = sales['name']
    print(f"  Created: Sales Glossary ({sales_name})")

    # Sales terms
    sales_terms = {}
    terms_data = [
        ("Lead", "Lead", "Potential customer who has shown initial interest in products or services"),
        ("Prospect", "Prospect", "Qualified lead with potential to become a paying customer"),
        ("Opportunity", "Opportunity", "Qualified prospect with an identified potential deal and timeline"),
        ("Deal", "Deal", "Active sales engagement with defined value, probability, and expected close date"),
        ("Customer", "Customer", "Individual or organization that has purchased products or services"),
        ("SalesPipeline", "Sales Pipeline", "Visual representation of sales process stages from lead to closed deal"),
        ("SalesQuota", "Sales Quota", "Target sales amount assigned to a sales team or individual for a period"),
        ("Bookings", "Bookings", "Total value of contracts signed in a given period"),
        ("WinRate", "Win Rate", "Percentage of opportunities that convert to closed deals"),
        ("SalesCycle", "Sales Cycle", "Average time from first contact to closed deal"),
        ("ACV", "Annual Contract Value", "Average annualized revenue per customer contract"),
    ]

    for name, display_name, description in terms_data:
        term = client.create_term(sales_name, name, display_name, description)
        if term:
            sales_terms[name] = term['id']
            print(f"    - {display_name}")

    # ========================================
    # 3. Marketing Glossary
    # ========================================
    print("\n[3/3] Creating Marketing Glossary...")
    marketing = client.create_glossary(
        "MarketingGlossary",
        "Marketing Glossary",
        "Marketing metrics, customer acquisition, and growth terminology"
    )
    marketing_name = marketing['name']
    print(f"  Created: Marketing Glossary ({marketing_name})")

    # Marketing terms
    marketing_terms = {}
    terms_data = [
        ("CAC", "Customer Acquisition Cost", "Total cost to acquire a new customer including marketing and sales expenses"),
        ("CLV", "Customer Lifetime Value", "Total revenue expected from a customer over their entire relationship"),
        ("LTV_CAC_Ratio", "LTV:CAC Ratio", "Ratio of customer lifetime value to customer acquisition cost"),
        ("MRR", "Monthly Recurring Revenue", "Predictable revenue generated each month from subscriptions"),
        ("ARR", "Annual Recurring Revenue", "Predictable revenue generated annually from subscriptions"),
        ("ChurnRate", "Churn Rate", "Percentage of customers who stop using the product or service in a period"),
        ("RetentionRate", "Retention Rate", "Percentage of customers who continue using the product or service"),
        ("ConversionRate", "Conversion Rate", "Percentage of visitors or leads who complete a desired action"),
        ("NPS", "Net Promoter Score", "Measure of customer loyalty and satisfaction"),
        ("ARPU", "Average Revenue Per User", "Average revenue generated per user or customer"),
    ]

    for name, display_name, description in terms_data:
        term = client.create_term(marketing_name, name, display_name, description)
        if term:
            marketing_terms[name] = term['id']
            print(f"    - {display_name}")

    # ========================================
    # 4. Create Relationships
    # ========================================
    print("\n" + "=" * 60)
    print("Creating Relationships Between Terms")
    print("=" * 60)

    # Finance relationships
    print("\nFinance relationships:")
    relations = [
        # Revenue hierarchy
        ("GrossRevenue", "Revenue", "narrower"),
        ("NetRevenue", "Revenue", "narrower"),
        # Cost hierarchy
        ("COGS", "Cost", "narrower"),
        ("OperatingExpenses", "Cost", "narrower"),
        # Profit calculations
        ("GrossProfit", "Revenue", "calculatedFrom"),
        ("GrossProfit", "COGS", "calculatedFrom"),
        ("Profit", "Revenue", "calculatedFrom"),
        ("Profit", "Cost", "calculatedFrom"),
        ("NetProfit", "GrossProfit", "calculatedFrom"),
        ("NetProfit", "OperatingExpenses", "calculatedFrom"),
        # Margin calculations
        ("GrossMargin", "GrossProfit", "calculatedFrom"),
        ("GrossMargin", "Revenue", "calculatedFrom"),
        ("NetMargin", "NetProfit", "calculatedFrom"),
        ("NetMargin", "Revenue", "calculatedFrom"),
        # EBITDA
        ("EBITDA", "Profit", "relatedTo"),
    ]
    for from_name, to_name, rel_type in relations:
        from_id = finance_terms.get(from_name)
        to_id = finance_terms.get(to_name)
        if from_id and to_id:
            client.add_relation(from_id, to_id, rel_type)
            print(f"  - Added {rel_type}: {from_name} -> {to_name}")

    # Sales relationships (Pipeline flow)
    print("\nSales relationships:")
    relations = [
        # Pipeline stages (Lead -> Prospect -> Opportunity -> Deal -> Customer)
        ("Prospect", "Lead", "broader"),
        ("Opportunity", "Prospect", "broader"),
        ("Deal", "Opportunity", "broader"),
        ("Customer", "Deal", "broader"),
        # Pipeline contains all stages
        ("SalesPipeline", "Lead", "hasPart"),
        ("SalesPipeline", "Prospect", "hasPart"),
        ("SalesPipeline", "Opportunity", "hasPart"),
        ("SalesPipeline", "Deal", "hasPart"),
        # Metrics relationships
        ("Bookings", "Deal", "calculatedFrom"),
        ("WinRate", "Opportunity", "calculatedFrom"),
        ("WinRate", "Deal", "calculatedFrom"),
        ("SalesQuota", "Bookings", "relatedTo"),
        ("ACV", "Bookings", "calculatedFrom"),
    ]
    for from_name, to_name, rel_type in relations:
        from_id = sales_terms.get(from_name)
        to_id = sales_terms.get(to_name)
        if from_id and to_id:
            client.add_relation(from_id, to_id, rel_type)
            print(f"  - Added {rel_type}: {from_name} -> {to_name}")

    # Marketing relationships
    print("\nMarketing relationships:")
    mkt_relations = [
        # Revenue metrics
        ("ARR", "MRR", "calculatedFrom"),
        ("ARPU", "MRR", "calculatedFrom"),
        # Customer value metrics
        ("CLV", "ARR", "calculatedFrom"),
        ("CLV", "ChurnRate", "calculatedFrom"),
        ("LTV_CAC_Ratio", "CLV", "calculatedFrom"),
        ("LTV_CAC_Ratio", "CAC", "calculatedFrom"),
        # Retention/Churn are antonyms
        ("RetentionRate", "ChurnRate", "antonym"),
        # Conversion affects CAC
        ("CAC", "ConversionRate", "calculatedFrom"),
    ]
    for from_name, to_name, rel_type in mkt_relations:
        from_id = marketing_terms.get(from_name)
        to_id = marketing_terms.get(to_name)
        if from_id and to_id:
            client.add_relation(from_id, to_id, rel_type)
            print(f"  - Added {rel_type}: {from_name} -> {to_name}")

    # Cross-glossary relationships
    print("\nCross-glossary relationships:")
    cross_relations = [
        # Sales -> Finance
        (finance_terms.get("Revenue"), sales_terms.get("Bookings"), "relatedTo", "Revenue -> Bookings"),
        (finance_terms.get("Revenue"), sales_terms.get("ACV"), "calculatedFrom", "Revenue -> ACV"),
        # Marketing -> Finance
        (finance_terms.get("Revenue"), marketing_terms.get("MRR"), "relatedTo", "Revenue -> MRR"),
        (finance_terms.get("Revenue"), marketing_terms.get("ARR"), "relatedTo", "Revenue -> ARR"),
        (marketing_terms.get("MRR"), finance_terms.get("Revenue"), "narrower", "MRR -> Revenue"),
        # Marketing -> Sales
        (marketing_terms.get("CLV"), sales_terms.get("Customer"), "calculatedFrom", "CLV -> Customer"),
        (marketing_terms.get("CAC"), sales_terms.get("Lead"), "calculatedFrom", "CAC -> Lead"),
        (marketing_terms.get("ConversionRate"), sales_terms.get("WinRate"), "relatedTo", "ConversionRate -> WinRate"),
    ]
    for from_id, to_id, rel_type, label in cross_relations:
        if from_id and to_id:
            client.add_relation(from_id, to_id, rel_type)
            print(f"  - Added {rel_type}: {label}")

    print("\n" + "=" * 60)
    print("DONE! Sample glossaries created successfully.")
    print("=" * 60)
    print("\nSummary:")
    print(f"  - Finance Glossary: {len(finance_terms)} terms")
    print(f"  - Sales Glossary: {len(sales_terms)} terms")
    print(f"  - Marketing Glossary: {len(marketing_terms)} terms")
    print("\nRefresh the Ontology Explorer at:")
    print(f"  {args.base_url}/governance/ontology")
    print("")


if __name__ == "__main__":
    main()
