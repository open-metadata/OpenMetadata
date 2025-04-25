---
title: Classify Business-Critical Data with Collate AI Tier Agent
slug: /collateai/tier-agent
collate: true
---

## Collate AI Tier Agent

### Overview

The Tier Agent analyzes data usage and lineage to suggest appropriate tier classifications for your assets, aiding in identifying business-critical data.

### Key Features

- **Automated Tier Suggestions**: Assigns tier classifications to assets based on their usage patterns and lineage information.

### Setup Instructions

1. **Navigate to Applications**: Go to `Settings > Applications`.

{% image
src="/images/v1.7/collate-ai/collate-ai-agent.png"
alt="setting up Collate AI"
caption="Navigate to Applications"
/%}

2. **Install the Agent**: Click on "Add Apps" to access the marketplace and install the Collate AI Tier Agent.

{% image
src="/images/v1.7/collate-ai/collate-ai-tier-agent.png"
alt="Installation"
caption="Installation"
/%}

3. **Configure the Agent**:
   - **Filter**: Use the UI Query Filter builder to select assets for tier classification.
   - **Patch Tier If Empty**: Enable this option to automatically assign a tier to assets that currently lack one.

{% image
src="/images/v1.7/collate-ai/collate-ai-tier-agent1.png"
alt="Configuration"
caption="Configuration"
/%}

4. **Scheduling**: Set up regular intervals for the agent to run and update metadata.

{% image
src="/images/v1.7/collate-ai/collate-ai-tier-agent2.png"
alt="Scheduling"
caption="Scheduling"
/%}
