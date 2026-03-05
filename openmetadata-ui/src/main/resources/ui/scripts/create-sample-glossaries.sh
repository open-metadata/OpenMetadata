#!/bin/bash
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

# Script to create sample glossaries with terms and relationships
# Run this against a local OpenMetadata instance

BASE_URL="http://localhost:8585/api/v1"
AUTH_TOKEN="${OM_AUTH_TOKEN:-}"

# Helper function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3

  if [ -n "$AUTH_TOKEN" ]; then
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

echo "Creating sample glossaries and terms..."

# ============================================
# 1. Create Finance Glossary
# ============================================
echo "Creating Finance Glossary..."
FINANCE_GLOSSARY=$(api_call POST "/glossaries" '{
  "name": "FinanceGlossary",
  "displayName": "Finance Glossary",
  "description": "Financial metrics, KPIs, and business terminology"
}')
FINANCE_ID=$(echo $FINANCE_GLOSSARY | jq -r '.id // empty')
echo "Finance Glossary ID: $FINANCE_ID"

# Finance Terms
echo "Creating Finance terms..."

# Revenue
REVENUE=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"Revenue\",
  \"displayName\": \"Revenue\",
  \"description\": \"Total income generated from sales of goods or services\"
}")
REVENUE_ID=$(echo $REVENUE | jq -r '.id // empty')

# Gross Revenue
GROSS_REVENUE=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"GrossRevenue\",
  \"displayName\": \"Gross Revenue\",
  \"description\": \"Total revenue before any deductions\"
}")
GROSS_REVENUE_ID=$(echo $GROSS_REVENUE | jq -r '.id // empty')

# Net Revenue
NET_REVENUE=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"NetRevenue\",
  \"displayName\": \"Net Revenue\",
  \"description\": \"Revenue after deducting returns, allowances, and discounts\"
}")
NET_REVENUE_ID=$(echo $NET_REVENUE | jq -r '.id // empty')

# Cost
COST=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"Cost\",
  \"displayName\": \"Cost\",
  \"description\": \"Expenses incurred in producing goods or services\"
}")
COST_ID=$(echo $COST | jq -r '.id // empty')

# COGS
COGS=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"COGS\",
  \"displayName\": \"Cost of Goods Sold\",
  \"description\": \"Direct costs attributable to production of goods sold\"
}")
COGS_ID=$(echo $COGS | jq -r '.id // empty')

# Operating Expenses
OPEX=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"OperatingExpenses\",
  \"displayName\": \"Operating Expenses\",
  \"description\": \"Expenses required for day-to-day business operations\"
}")
OPEX_ID=$(echo $OPEX | jq -r '.id // empty')

# Profit
PROFIT=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"Profit\",
  \"displayName\": \"Profit\",
  \"description\": \"Financial gain after deducting expenses from revenue\"
}")
PROFIT_ID=$(echo $PROFIT | jq -r '.id // empty')

# Gross Margin
GROSS_MARGIN=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"GrossMargin\",
  \"displayName\": \"Gross Margin\",
  \"description\": \"Revenue minus cost of goods sold, expressed as percentage\"
}")
GROSS_MARGIN_ID=$(echo $GROSS_MARGIN | jq -r '.id // empty')

# Net Margin
NET_MARGIN=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$FINANCE_ID\",
  \"name\": \"NetMargin\",
  \"displayName\": \"Net Margin\",
  \"description\": \"Net profit as a percentage of revenue\"
}")
NET_MARGIN_ID=$(echo $NET_MARGIN | jq -r '.id // empty')

# ============================================
# 2. Create Sales Glossary
# ============================================
echo "Creating Sales Glossary..."
SALES_GLOSSARY=$(api_call POST "/glossaries" '{
  "name": "SalesGlossary",
  "displayName": "Sales Glossary",
  "description": "Sales metrics, pipeline terminology, and customer lifecycle"
}')
SALES_ID=$(echo $SALES_GLOSSARY | jq -r '.id // empty')
echo "Sales Glossary ID: $SALES_ID"

# Sales Terms
echo "Creating Sales terms..."

# Lead
LEAD=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Lead\",
  \"displayName\": \"Lead\",
  \"description\": \"Potential customer who has shown interest in products/services\"
}")
LEAD_ID=$(echo $LEAD | jq -r '.id // empty')

# Prospect
PROSPECT=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Prospect\",
  \"displayName\": \"Prospect\",
  \"description\": \"Qualified lead with potential to become a customer\"
}")
PROSPECT_ID=$(echo $PROSPECT | jq -r '.id // empty')

# Opportunity
OPPORTUNITY=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Opportunity\",
  \"displayName\": \"Opportunity\",
  \"description\": \"Qualified prospect with identified potential deal\"
}")
OPPORTUNITY_ID=$(echo $OPPORTUNITY | jq -r '.id // empty')

# Deal
DEAL=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Deal\",
  \"displayName\": \"Deal\",
  \"description\": \"Active sales engagement with defined value and timeline\"
}")
DEAL_ID=$(echo $DEAL | jq -r '.id // empty')

# Customer
CUSTOMER=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Customer\",
  \"displayName\": \"Customer\",
  \"description\": \"Individual or organization that purchases products/services\"
}")
CUSTOMER_ID=$(echo $CUSTOMER | jq -r '.id // empty')

# Sales Pipeline
PIPELINE=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"SalesPipeline\",
  \"displayName\": \"Sales Pipeline\",
  \"description\": \"Visual representation of sales process stages\"
}")
PIPELINE_ID=$(echo $PIPELINE | jq -r '.id // empty')

# Sales Quota
QUOTA=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"SalesQuota\",
  \"displayName\": \"Sales Quota\",
  \"description\": \"Target sales amount assigned to sales team or individual\"
}")
QUOTA_ID=$(echo $QUOTA | jq -r '.id // empty')

# Bookings
BOOKINGS=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$SALES_ID\",
  \"name\": \"Bookings\",
  \"displayName\": \"Bookings\",
  \"description\": \"Value of contracts signed in a period\"
}")
BOOKINGS_ID=$(echo $BOOKINGS | jq -r '.id // empty')

# ============================================
# 3. Create Marketing Glossary
# ============================================
echo "Creating Marketing Glossary..."
MARKETING_GLOSSARY=$(api_call POST "/glossaries" '{
  "name": "MarketingGlossary",
  "displayName": "Marketing Glossary",
  "description": "Marketing metrics, customer acquisition, and campaign terminology"
}')
MARKETING_ID=$(echo $MARKETING_GLOSSARY | jq -r '.id // empty')
echo "Marketing Glossary ID: $MARKETING_ID"

# Marketing Terms
echo "Creating Marketing terms..."

# CAC
CAC=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"CAC\",
  \"displayName\": \"Customer Acquisition Cost\",
  \"description\": \"Total cost to acquire a new customer\"
}")
CAC_ID=$(echo $CAC | jq -r '.id // empty')

# CLV/LTV
CLV=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"CLV\",
  \"displayName\": \"Customer Lifetime Value\",
  \"description\": \"Total revenue expected from a customer over their relationship\"
}")
CLV_ID=$(echo $CLV | jq -r '.id // empty')

# MRR
MRR=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"MRR\",
  \"displayName\": \"Monthly Recurring Revenue\",
  \"description\": \"Predictable revenue generated each month from subscriptions\"
}")
MRR_ID=$(echo $MRR | jq -r '.id // empty')

# ARR
ARR=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"ARR\",
  \"displayName\": \"Annual Recurring Revenue\",
  \"description\": \"Predictable revenue generated annually from subscriptions\"
}")
ARR_ID=$(echo $ARR | jq -r '.id // empty')

# Churn Rate
CHURN=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"ChurnRate\",
  \"displayName\": \"Churn Rate\",
  \"description\": \"Percentage of customers who stop using product/service\"
}")
CHURN_ID=$(echo $CHURN | jq -r '.id // empty')

# Conversion Rate
CONVERSION=$(api_call POST "/glossaryTerms" "{
  \"glossary\": \"$MARKETING_ID\",
  \"name\": \"ConversionRate\",
  \"displayName\": \"Conversion Rate\",
  \"description\": \"Percentage of visitors who complete desired action\"
}")
CONVERSION_ID=$(echo $CONVERSION | jq -r '.id // empty')

# ============================================
# 4. Create Relationships
# ============================================
echo ""
echo "Creating relationships between terms..."

# Function to add related term
add_relation() {
  local term_id=$1
  local related_id=$2
  local relation_type=$3

  # Get current term
  local term_data=$(api_call GET "/glossaryTerms/$term_id" "")
  local term_fqn=$(echo $term_data | jq -r '.fullyQualifiedName')

  # Get related term FQN
  local related_data=$(api_call GET "/glossaryTerms/$related_id" "")
  local related_fqn=$(echo $related_data | jq -r '.fullyQualifiedName')

  echo "  Adding relation: $relation_type from $term_fqn to $related_fqn"

  # Add relation using PATCH
  api_call PATCH "/glossaryTerms/$term_id" "[
    {
      \"op\": \"add\",
      \"path\": \"/relatedTerms/-\",
      \"value\": {
        \"term\": {
          \"id\": \"$related_id\",
          \"type\": \"glossaryTerm\"
        },
        \"relationType\": \"$relation_type\"
      }
    }
  ]" > /dev/null
}

# Finance relationships
echo "Finance term relationships..."
add_relation "$GROSS_REVENUE_ID" "$REVENUE_ID" "narrower"
add_relation "$NET_REVENUE_ID" "$REVENUE_ID" "narrower"
add_relation "$COGS_ID" "$COST_ID" "narrower"
add_relation "$OPEX_ID" "$COST_ID" "narrower"
add_relation "$PROFIT_ID" "$REVENUE_ID" "calculatedFrom"
add_relation "$PROFIT_ID" "$COST_ID" "calculatedFrom"
add_relation "$GROSS_MARGIN_ID" "$REVENUE_ID" "calculatedFrom"
add_relation "$GROSS_MARGIN_ID" "$COGS_ID" "calculatedFrom"
add_relation "$NET_MARGIN_ID" "$PROFIT_ID" "calculatedFrom"
add_relation "$NET_MARGIN_ID" "$REVENUE_ID" "calculatedFrom"

# Sales pipeline relationships (Lead -> Prospect -> Opportunity -> Deal -> Customer)
echo "Sales term relationships..."
add_relation "$PROSPECT_ID" "$LEAD_ID" "broader"
add_relation "$OPPORTUNITY_ID" "$PROSPECT_ID" "broader"
add_relation "$DEAL_ID" "$OPPORTUNITY_ID" "broader"
add_relation "$CUSTOMER_ID" "$DEAL_ID" "broader"
add_relation "$PIPELINE_ID" "$LEAD_ID" "hasPart"
add_relation "$PIPELINE_ID" "$PROSPECT_ID" "hasPart"
add_relation "$PIPELINE_ID" "$OPPORTUNITY_ID" "hasPart"
add_relation "$PIPELINE_ID" "$DEAL_ID" "hasPart"
add_relation "$QUOTA_ID" "$BOOKINGS_ID" "relatedTo"
add_relation "$BOOKINGS_ID" "$DEAL_ID" "calculatedFrom"

# Marketing relationships
echo "Marketing term relationships..."
add_relation "$ARR_ID" "$MRR_ID" "calculatedFrom"
add_relation "$CLV_ID" "$CHURN_ID" "calculatedFrom"
add_relation "$CLV_ID" "$ARR_ID" "calculatedFrom"
add_relation "$CAC_ID" "$CONVERSION_ID" "relatedTo"

# Cross-glossary relationships
echo "Cross-glossary relationships..."
add_relation "$REVENUE_ID" "$BOOKINGS_ID" "relatedTo"
add_relation "$CLV_ID" "$CUSTOMER_ID" "calculatedFrom"
add_relation "$CAC_ID" "$LEAD_ID" "calculatedFrom"
add_relation "$MRR_ID" "$REVENUE_ID" "narrower"

echo ""
echo "Done! Sample glossaries created with relationships."
echo ""
echo "Summary:"
echo "  - Finance Glossary: Revenue, Gross Revenue, Net Revenue, Cost, COGS, OpEx, Profit, Gross Margin, Net Margin"
echo "  - Sales Glossary: Lead, Prospect, Opportunity, Deal, Customer, Sales Pipeline, Sales Quota, Bookings"
echo "  - Marketing Glossary: CAC, CLV, MRR, ARR, Churn Rate, Conversion Rate"
echo ""
echo "Refresh the Ontology Explorer to see the graph!"
