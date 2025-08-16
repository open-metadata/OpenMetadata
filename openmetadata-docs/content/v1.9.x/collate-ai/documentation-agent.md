---
title: Automate Metadata Descriptions with Collate AI Documentation Agent
slug: /collateai/documentation-agent
collate: true
---

# Collate AI Documentation Agent

## Overview

The Documentation Agent utilizes generative AI to automatically generate metadata descriptions for data assets, facilitating better understanding and accessibility.

## Key Features

- **Automated Schema Labeling**: Generates clear and concise descriptions for tables and columns, reducing manual documentation efforts.
- **Natural Language SQL Query Generation**: Enables users to create SQL queries by interacting with the MetaPilot chatbot using everyday language.
- **Intelligent Query Assistance**: Assists in building, refining, and optimizing SQL queries, including handling table joins and relationships.

## Setup Instructions

1. **Navigate to Applications**: Go to `Settings > Applications`.

{% image
src="/images/v1.9/collate-ai/collate-ai-agent.png"
alt="Navigate to Applications"
caption="Navigate to Applications"
/%}

2. **Install the Agent**: Click on "Add Apps" to access the marketplace and install the Collate AI Documentation Agent.

{% image
src="/images/v1.9/collate-ai/collate-ai-documentation-agent.png"
alt="Installation"
caption="Installation"
/%}

3. **Configure the Agent**:
   - **Filter**: Use the UI Query Filter builder to select assets based on properties like service, database, schema, name, owners, domain, or custom properties.
   - **Add Description If Empty**: Enable this option to automatically add descriptions to assets lacking them.

{% image
src="/images/v1.9/collate-ai/collate-ai-documentation-agent1.png"
alt="Configuration"
caption="Configuration"
/%}

4. **Scheduling**: Set up regular intervals for the agent to run and update metadata.

{% image
src="/images/v1.9/collate-ai/collate-ai-documentation-agent2.png"
alt="Scheduling"
caption="Scheduling"
/%}
