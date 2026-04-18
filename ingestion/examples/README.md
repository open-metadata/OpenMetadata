# OpenMetadata AI SDK Recipes
### By Baibhav Prateek | Hackathon 2026

## Overview
This is my submission for the OpenMetadata Hackathon 2026.
I built 3 notebooks that showcase how to use AI with OpenMetadata.

## Notebooks
### 1. Metadata Health Report
- Connects to OpenMetadata
- Analyzes table and column documentation quality
- Generates health score and visual charts
- Saves results to CSV files

### 2. LangChain OpenMetadata Template
- Reusable template connecting AI to OpenMetadata
- Ask questions about your data in plain English
- Uses Groq AI (LLaMA 3) for natural language processing

### 3. OpenMetadata AI Agent
- Intelligent agent that decides how to search automatically
- Uses multiple tools to fetch the right data
- Most advanced of the three notebooks

## How to Run

### Prerequisites
pip install openmetadata-ingestion groq google-genai requests pandas matplotlib

### Setup
1. Get your OpenMetadata token from sandbox.open-metadata.org
2. Get your free Groq API key from console.groq.com
3. Replace the placeholder keys in Cell 1 of each notebook
4. Run all cells in order

## Technologies Used
- OpenMetadata API
- Groq AI (LLaMA 3.3 70b)
- Python, Pandas, Matplotlib
- Jupyter Notebooks