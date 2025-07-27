---
title: Collate AI
slug: /collateai
collate: true
---

# Collate AI Technical Documentation

{%  youtube videoId="6glMYLzxNqk" start="0:00" end="04:20" width="800px" height="450px" /%}

Collate AI is an AI-powered tool within Collate that simplifies and enhances metadata management. By integrating generative AI, Collate AI assists users in automating the documentation of data assets, writing and optimizing SQL queries, and interacting with data through natural language. This first-of-its-kind data copilot improves productivity by automating tedious tasks and providing intelligent insights into your data environment.

## Key Features

- **Automated Data Documentation**: Automatically generates metadata descriptions for tables and columns, saving time and effort for data owners and stewards.
- **Natural Language SQL Query Generation**: Allows users to interact with Collate AI through a chatbot to generate SQL queries by simply asking questions in plain English.
- **SQL Query Optimization and Fixing**: Capable of optimizing and troubleshooting SQL queries to improve their performance and efficiency.
- **AI-Driven Test Automation**: Automatically suggests and deploys relevant data quality tests based on table constraints and similarity with other assets, streamlining your data validation efforts.
- **Automated Tier Classification**: Uses data lineage and usage analytics to intelligently assign Tier levels, helping teams prioritize and govern critical data assets.

## Why Collate AI is Useful

### Metadata Management Challenges

Managing metadata across multiple data assets can be overwhelming due to the influx of new data and changing team dynamics. Collate AI addresses these challenges by:

- Automating metadata description generation.
- Simplifying the creation and optimization of SQL queries.
- Reducing manual effort and enhancing data quality.

### Time-Saving Features

Documenting thousands of tables manually is tedious and time-consuming. Collate AI automates metadata generation, allowing data teams to focus on high-value tasks and ensuring that data assets are consistently documented and understood across the organization.

## Use Cases

### 1. Automatic Data Asset Documentation

{% image
src="/images/v1.7/collate-ai/reviewing-generated-metadata.png"
alt="Automatic Data Asset Documentation"
caption="Auto Generate data Asset Documentation"
/%}

- **Problem**: Manually creating metadata descriptions for large datasets is labor-intensive and error-prone.
- **Solution**: Collate AI’s generative AI automates the process, analyzing database structures and suggesting accurate descriptions for tables and columns.
- **How It Works**: After configuring Collate AI, it scans the database schema and generates metadata descriptions automatically. Users can review these descriptions and approve or reject them in bulk or individually.
- **Benefit**: Streamlines the documentation process, ensuring consistent and up-to-date metadata across all datasets.

### 2. Natural Language SQL Query Generation

{% image
src="/images/v1.7/collate-ai/using-collate-ai-chatbot-2.png"
alt="Natural Language SQL Query Generation"
caption="Natural Language SQL Query Generation"
/%}

- **Problem**: Non-technical users often struggle with writing SQL queries to extract insights from databases.
- **Solution**: Collate AI’s chatbot allows users to ask questions in natural language, generating SQL queries and providing explanations to help extract the required data quickly and easily.
- **How It Works**: Users can click on the Collate AI chatbot widget and ask questions like "Show me sales data from last quarter." Collate AI generates the corresponding SQL query and explains its logic.
- **Benefit**: Democratizes data access by enabling users of all technical levels to interact with data without deep SQL knowledge.

### 3. SQL Query Optimization and Troubleshooting

{% image
src="/images/v1.7/collate-ai/fixing-sql-queries-3.png"
alt="SQL Query Optimization and Troubleshooting"
caption="SQL Query Optimization"
/%}

- **Problem**: SQL queries can become complex and inefficient, leading to performance issues and increased costs.
- **Solution**: Collate AI optimizes inefficient queries to improve performance, saving both time and resources.
- **How It Works**: If a query runs too long, users can request Collate AI to optimize it. Collate AI provides a more efficient SQL query version that can be implemented immediately.
- **Benefit**: Enhances query performance, reduces costs associated with inefficient queries, and speeds up data processing.

### 4. Fixing SQL Queries

{% image
src="/images/v1.7/collate-ai/fixing-sql-queries-4.png"
alt="Fixing SQL Queries"
caption="Fixing SQL Queries"
/%}

- **Problem**: Complex queries can cause issues even for SQL experts.
- **Solution**: Collate AI can fix problematic SQL queries, ensuring they run correctly and efficiently.
- **How It Works**: Users can ask Collate AI, "Can you fix this query for me?" It analyzes the query, detects issues, and returns a corrected version ready for use.
- **Benefit**: Simplifies writing and maintaining queries, allowing data teams to focus on analysis rather than troubleshooting.
