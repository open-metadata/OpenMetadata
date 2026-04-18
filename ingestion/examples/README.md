# 🤖 OpenMetadata AI SDK Recipes
### By Baibhav Prateek | OpenMetadata Hackathon 2026

## 🎯 Problem Statement
Most data teams struggle with poor metadata quality — tables without 
descriptions, no owners assigned, and no easy way to explore their 
data catalog using natural language. This project solves all three 
problems using AI.

## 💡 Solution
Three ready-to-use Jupyter notebooks that demonstrate how to combine 
OpenMetadata's REST API with AI to build powerful metadata workflows.

---

## 📓 Notebooks

### 1. 🏥 Metadata Health Report (`metadata_health_report.ipynb`)
**Problem it solves:** Data teams have no visibility into how well 
their metadata is documented.

**What it does:**
- Connects to OpenMetadata and fetches all tables
- Checks which tables are missing descriptions and owners
- Calculates an overall health score (0-100)
- Generates visual charts showing coverage
- Exports results to CSV for further analysis

**Sample Output:**
==================================================
📊 MY OPENMETADATA HEALTH REPORT
Total Tables Analyzed  : 50
✅ Have Description    : 24 (48%)
❌ Missing Description : 26 (52%)
✅ Have Owner          : 0 (0%)
❌ Missing Owner       : 50 (100%)
Overall Health Score   : 24/100
Status                 : 🔴 CRITICAL

---

### 2. 🔗 AI Template (`langchain_openmetadata_template.ipynb`)
**Problem it solves:** Developers need a reusable starting point 
for building AI-powered data catalog applications.

**What it does:**
- Provides a clean, reusable template connecting Groq AI to OpenMetadata
- Fetches real metadata context from OpenMetadata
- Uses LLaMA 3.3 70b to answer questions about your data
- Anyone can customize this template for their own use case

**Sample Questions it answers:**
- "Which tables look incomplete or poorly documented?"
- "What kind of organization does this data belong to?"
- "Which tables should a new data analyst explore first?"

---

### 3. 🤖 AI Agent (`openmetadata_ai_agent.ipynb`)
**Problem it solves:** Users have to know exactly what to search 
for in their data catalog. This agent makes it conversational.

**What it does:**
- Intelligent agent that automatically decides how to search
- Has 3 tools: get_tables, search_tables, get_databases
- AI decides which tool to use based on your question
- Returns human-friendly answers with full reasoning shown

**Sample Interaction:**
❓ User: Find tables related to orders
🧠 Agent thinking...
🔧 Agent decided to use: search_tables: orders
📦 Data fetched: ['raw_orders', 'fact_orders', 'orders'...]
🤖 Answer: Found several order-related tables...

---

## 🚀 Quick Start

### Prerequisites
```bash
pip install openmetadata-ingestion groq requests pandas matplotlib jupyter
```

### Setup
1. Get your OpenMetadata token from your profile page
2. Get a free Groq API key from console.groq.com
3. Open any notebook and replace the placeholders in Cell 1:
```python
GROQ_API_KEY = "your_groq_api_key_here"
TOKEN = "your_openmetadata_token_here"
```
4. Run all cells in order!

---

## 🛠️ Technologies Used
- **OpenMetadata REST API** — metadata fetching and search
- **Groq AI (LLaMA 3.3 70b)** — natural language processing
- **Python** — core language
- **Pandas** — data analysis
- **Matplotlib** — visualization
- **Jupyter Notebooks** — interactive environment

## 🎯 Impact
These notebooks help data teams:
- **Identify** poorly documented tables instantly
- **Explore** their data catalog using natural language
- **Build** AI-powered metadata applications faster

## 📁 File Structure
ingestion/examples/
├── metadata_health_report.ipynb    # Health scoring notebook
├── langchain_openmetadata_template.ipynb  # AI template notebook
├── openmetadata_ai_agent.ipynb     # AI agent notebook
├── requirements.txt                # Dependencies
└── README.md                       # This file

## 🔗 Related Issue
This submission is for issue #26646 — Metadata AI SDK Starter 
Templates / Recipes