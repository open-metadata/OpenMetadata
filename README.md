<br /><br />
<p align="center">
    <a href="https://open-metadata.org">
        <img alt="Logo" src="https://github.com/open-metadata/OpenMetadata/assets/40225091/e794ced8-7220-4393-8efc-3faf93bfb503" width="49%">
    </a>
</p>

<p align="center"><b>Empower your Data Journey with OpenMetadata</b></p>

<div align="center">
    
![Commit Activity](https://img.shields.io/github/commit-activity/m/open-metadata/OpenMetadata?style=for-the-badge)
[![Release](https://img.shields.io/github/release/open-metadata/OpenMetadata/all.svg?style=for-the-badge)](https://github.com/open-metadata/OpenMetadata/releases)

</div>

# OpenMetadata

## The Open Semantic Context Platform for Data and AI

OpenMetadata is the open platform for building trusted data context and business semantics for humans, AI assistants, and agents.

OpenMetadata connects technical metadata, data quality signals, data lineage, column-level lineage, ownership, usage, policies, conversations, glossaries, classifications, metrics, domains, and data products into a unified metadata knowledge graph. With 120+ connectors, open metadata standards, semantic search, APIs, SDKs, and an MCP server, OpenMetadata gives every user and AI system the governed context it needs to discover, understand, trust, and use data.

AI does not need another raw database connector. AI needs context.

OpenMetadata provides that context:

- what data exists
- what it means
- who owns it
- how it is used
- where it came from
- where it flows
- whether it is fresh, tested, and trusted
- which business concepts, glossary terms, classifications, and policies apply
- what downstream assets, dashboards, pipelines, metrics, and ML models depend on it

---

## Contents

- [Why OpenMetadata for AI?](#why-openmetadata-for-ai)
- [Context: Give AI the Full Picture of Your Data](#context-give-ai-the-full-picture-of-your-data)
- [Semantics: Give AI Business Meaning](#semantics-give-ai-business-meaning)
- [Knowledge Graphs and Ontologies](#knowledge-graphs-and-ontologies)
- [Automation: Activate Context and Semantics with AI](#automation-activate-context-and-semantics-with-ai)
- [What You Can Build](#what-you-can-build)
- [How OpenMetadata Works](#how-openmetadata-works)
- [MCP: Connect AI Assistants and Agents](#mcp-connect-ai-assistants-and-agents)
- [Semantic Search](#semantic-search)
- [OpenMetadata Standards](#openmetadata-standards)
- [Core Platform Capabilities](#core-platform-capabilities)
- [Quickstart](#quickstart)
- [Documentation and Community](#documentation-and-community)
- [Contributing](#contributing)
- [License](#license)

---

## Why OpenMetadata for AI?

AI needs more than data access. It needs context, semantics, trust, lineage, governance, and operational awareness.

Connecting an AI assistant directly to a database, warehouse, dashboard, or pipeline only gives it raw access to data structures. It does not give the AI enough context to understand what the data means, whether it can be trusted, who owns it, how it is governed, or what downstream systems depend on it.

OpenMetadata gives AI systems the context and semantics they need to safely discover, understand, govern, and use enterprise data.

OpenMetadata does this by combining four capabilities:

1. **Context** — technical, operational, trust, and lineage metadata from the data ecosystem.
2. **Semantics** — business meaning through glossaries, metrics, classifications, domains, policies, and ontologies.
3. **Knowledge Graph** — relationships connecting assets, columns, people, teams, policies, lineage, quality, and business concepts.
4. **Automation** — MCP, Semantic Search, APIs, SDKs, events, and workflows that let AI assistants and agents act on governed metadata.

With OpenMetadata, AI can answer questions such as:

- What does this metric mean?
- Which datasets power this dashboard?
- Who owns this data product?
- Is this dataset certified, fresh, and high quality?
- What downstream dashboards or ML models are affected by this column change?
- Which assets are related to customer purchase behavior, even if they use different names?
- Which columns contain sensitive customer information?
- Which glossary terms and business concepts apply to this dataset?

---

## Context: Give AI the Full Picture of Your Data

Context is the metadata that describes how data exists, behaves, changes, flows, and is used across the organization.

OpenMetadata collects context from across your data stack and connects it into a unified metadata graph.

### Technical Metadata

OpenMetadata gives AI access to technical metadata such as:

- databases, schemas, tables, columns, topics, dashboards, charts, pipelines, APIs, search indexes, ML models, and storage assets
- schemas, column names, data types, constraints, descriptions, sample queries, joins, and service metadata
- service configuration, ingestion metadata, and operational metadata
- owners, teams, users, personas, domains, data products, and usage patterns

### Data Quality and Trust Signals

AI should not treat every dataset as equally trustworthy.

OpenMetadata gives AI access to trust signals such as:

- data quality tests
- test suites and test results
- freshness checks
- volume checks
- null, uniqueness, distribution, and custom tests
- profiling results
- observability signals
- data quality history
- incidents, alerts, and operational health signals

### Data Lineage and Impact

AI needs to understand where data comes from and where it goes.

OpenMetadata captures:

- upstream and downstream lineage
- table-level lineage
- dashboard lineage
- pipeline lineage
- metric lineage
- ML model lineage
- API and topic dependencies
- impact analysis across the data estate

### Column-Level Lineage

For precise AI reasoning, table-level lineage is not enough.

OpenMetadata helps AI understand:

- which source columns produce which downstream columns
- how columns flow through transformations
- which dashboards, reports, metrics, or ML models depend on a specific column
- what may break when a column changes

### Connected from 120+ Data Services

OpenMetadata brings this context together from databases, warehouses, lakes, dashboards, pipelines, messaging systems, ML platforms, storage systems, APIs, search systems, and metadata systems.

Context answers questions like:

- What data exists?
- Where did this data come from?
- Who owns it?
- Is it fresh?
- Is it tested?
- Is it trusted?
- What systems depend on it?
- What happens if it changes?

---

## Semantics: Give AI Business Meaning

Semantics is the business meaning layered on top of technical context.

Without semantics, AI may see a column named `cust_id`, `acct_id`, or `buyer_key`, but it may not know whether those fields represent a customer, an account, a buyer, a household, or a legal entity.

OpenMetadata lets teams define, govern, and connect business meaning across the metadata graph.

### Business Concepts

Define the concepts that matter to the business, such as:

- Customer
- Account
- Order
- Revenue
- Product
- Consent
- Churn
- Risk
- Lifetime Value
- Net Retention
- Active User
- Sensitive Data

### Glossaries and Glossary Terms

OpenMetadata lets teams create governed vocabularies with:

- business definitions
- synonyms and abbreviations
- owners and reviewers
- related terms
- hierarchical terms
- links to tables, columns, dashboards, metrics, and data products

### Metrics and KPIs

Metrics are one of the most important semantic objects for AI.

OpenMetadata helps AI understand:

- what a metric means
- how it is calculated
- who owns it
- which dashboards use it
- which tables power it
- which glossary terms define it
- which downstream consumers depend on it

### Classifications and Tags

OpenMetadata lets teams classify and label data with governed tags such as:

- PII
- Sensitive
- Confidential
- Certified
- Deprecated
- Tier 1
- Finance
- Marketing
- GDPR
- HIPAA
- SOX
- ML Feature
- Customer Data

### Domains and Data Products

OpenMetadata connects assets to business ownership boundaries through:

- domains
- data products
- teams
- owners
- policies
- personas
- data product consumers

### Policies and Governance

OpenMetadata connects semantics to governance so AI systems can reason with policy-aware context, not just metadata.

This includes:

- ownership
- stewardship
- classification
- access control context
- certification
- review workflows
- governance policies
- lifecycle states

Semantics answers questions like:

- What does this data mean?
- What business concept does this column represent?
- Is this metric officially defined?
- Is this asset certified?
- Is this data sensitive?
- Which glossary terms apply?
- Which domain owns this data product?

---

## Knowledge Graphs and Ontologies

OpenMetadata connects context and semantics into a unified metadata knowledge graph.

The graph does not just store data assets. It stores the relationships between data assets, people, teams, policies, quality tests, lineage, classifications, glossary terms, metrics, domains, and data products.

This makes OpenMetadata a semantic context layer for AI.

Example relationships:

```text
Table ──hasColumn────────────> Column
Column ──classifiedAs────────> PII
Column ──represents──────────> Customer Identifier
Table ──ownedBy──────────────> Data Engineering Team
Table ──partOf───────────────> Customer 360 Data Product
Dashboard ──dependsOn────────> Table
Metric ──definedBy───────────> Glossary Term
Pipeline ──produces──────────> Table
Column ──flowsTo─────────────> Column
Test Case ──validates────────> Table
Domain ──contains────────────> Data Product
Glossary Term ──relatedTo────> Business Concept
Policy ──governs─────────────> Classification
```

With this graph, AI can reason across relationships:

- Which datasets power this dashboard?
- What does this metric mean?
- Who owns this data product?
- Is this table fresh, certified, and high quality?
- Which downstream dashboards or ML models are affected by this column change?
- Which assets are related to customer purchase behavior, even if they use different names?
- Which columns represent sensitive customer information?
- Which business concepts are connected to this data product?

### Ontologies and Semantic Interoperability

OpenMetadata is built on open metadata standards.

[OpenMetadata Standards](https://openmetadatastandards.org/) provides schemas, ontologies, and semantic specifications for interoperable metadata management, including:

- JSON Schemas for metadata entities, APIs, configurations, events, and relationships
- RDF/OWL ontologies for semantic web, linked data, and knowledge graph use cases
- SHACL shapes for validation
- JSON-LD contexts for semantic interoperability
- standards for governance, lineage, quality, observability, teams, users, policies, and events

These standards make OpenMetadata more than a catalog. They make it a foundation for interoperable semantic metadata, linked data, and enterprise knowledge graphs.

---

## Automation: Activate Context and Semantics with AI

OpenMetadata makes the metadata graph actionable.

AI assistants, coding agents, data teams, governance teams, and applications can use OpenMetadata through:

- MCP
- Semantic Search
- APIs
- SDKs
- events
- webhooks
- ingestion workflows
- metadata applications

### MCP Server

OpenMetadata includes an MCP server that lets AI assistants and MCP-compatible clients interact with the metadata graph through natural language.

With OpenMetadata MCP, AI assistants can:

- search metadata
- run semantic search
- retrieve entity details
- inspect upstream and downstream lineage
- create glossaries and glossary terms
- create lineage
- update descriptions, tags, owners, and other metadata
- list data quality test definitions
- create data quality test cases
- analyze root causes of data quality failures

Get started with MCP:
[OpenMetadata MCP Server Documentation](https://docs.open-metadata.org/how-to-guides/mcp)

### Semantic Search

Semantic Search lets users and AI assistants search by meaning, not just by exact keywords.

For example, a user can ask:

> Find tables related to customer purchase behavior and transaction history.

OpenMetadata can return conceptually related assets even when the exact words in the query do not appear in the asset names.

This helps AI answer questions such as:

- Which datasets are related to customer behavior?
- What dashboards do we have for revenue forecasting?
- Show me assets related to user engagement metrics.
- Find pipelines that process financial compliance data.

### AI SDK

Developers can use OpenMetadata’s AI SDK to build custom AI applications that use OpenMetadata MCP tools programmatically.

The AI SDK enables AI applications to use OpenMetadata context from Python, TypeScript, and Java.

### APIs, Events, and Webhooks

OpenMetadata exposes APIs, events, and webhooks so teams can automate metadata workflows across their data ecosystem.

Use them to:

- ingest and update metadata
- react to metadata changes
- trigger governance workflows
- integrate with collaboration tools
- build custom metadata applications
- synchronize context across systems

### Coding Agents and AI Assistants

OpenMetadata can connect to MCP-compatible assistants and agents such as:

- Claude Desktop
- Claude Code
- Goose
- Cursor
- VS Code
- Codex
- custom LLM applications
- internal enterprise AI assistants

This allows coding agents and data assistants to understand schemas, glossary definitions, ownership, lineage, quality requirements, and downstream dependencies before generating SQL, dbt models, documentation, tests, migration plans, or impact analysis.

---

## What You Can Build

### AI Data Discovery

Ask natural-language questions over your metadata graph and find relevant assets, even when names and keywords do not match exactly.

Example:

> Find datasets related to customer purchase behavior and transaction history.

### Trusted AI Assistants

Ground AI responses in governed metadata: owners, descriptions, glossary terms, tags, classifications, quality signals, freshness, usage, and lineage.

Example:

> Explain what this dashboard measures and whether the underlying data is trusted.

### Impact Analysis Agents

Ask what will break if a table, column, pipeline, dashboard, metric, or ML feature changes.

Example:

> What downstream dashboards and ML models are affected if `customer_id` changes in this table?

### Governance Automation

Use agents to suggest descriptions, assign glossary terms, identify sensitive data, create classifications, propose ownership, and manage stewardship workflows.

Example:

> Review this new table, suggest glossary terms, and identify possible PII columns.

### Data Quality Automation

Use AI workflows to create tests, summarize failures, identify root causes, and recommend remediation steps.

Example:

> Investigate why this data quality test failed and identify upstream changes that may have caused it.

### Semantic Knowledge Graphs

Build interoperable metadata knowledge graphs using OpenMetadata Standards, RDF/OWL, JSON-LD, SHACL, and OpenMetadata’s entity relationships.

Example:

> Find all assets related to customer risk that contain sensitive data and are used by revenue dashboards.

### Developer and Coding Agent Workflows

Connect coding agents to OpenMetadata so they can understand schemas, owners, lineage, business definitions, and quality requirements before generating code, queries, dbt models, tests, or migration plans.

Example:

> Generate a dbt model for this customer table and include tests based on OpenMetadata quality expectations.

---

## How OpenMetadata Works

OpenMetadata is built around an open, schema-first metadata graph.

```text
                  ┌──────────────────────────────────────────┐
                  │              Data Ecosystem              │
                  │ Warehouses | Lakes | BI | Pipelines | ML │
                  │ APIs | Topics | Storage | Search | SaaS  │
                  └─────────────────────┬────────────────────┘
                                        │
                              120+ Connectors
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────┐
│                         OpenMetadata                               │
│                                                                    │
│  Context Layer                                                     │
│  - technical metadata                                              │
│  - quality and observability signals                               │
│  - table and column-level lineage                                  │
│  - ownership, usage, domains, data products                        │
│                                                                    │
│  Semantics Layer                                                   │
│  - business concepts                                               │
│  - glossaries and glossary terms                                   │
│  - classifications and tags                                        │
│  - metrics and KPIs                                                │
│  - ontologies and semantic standards                               │
│                                                                    │
│  Knowledge Graph                                                   │
│  - assets, people, teams, policies, lineage, quality, semantics    │
└─────────────────────────────────────┬──────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
   Semantic Search                  APIs                         MCP Server
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      ▼
                         AI Assistants and Agents
              Claude | Claude Code | Cursor | VS Code | Codex
                    Goose | Custom Apps | AI SDK Workflows
```

### Platform Components

OpenMetadata consists of five core layers:

1. **Open Metadata Standards**  
   Canonical schemas, APIs, RDF/OWL ontologies, SHACL shapes, JSON-LD contexts, and event models for metadata interoperability.

2. **Metadata Store and Knowledge Graph**  
   A central repository that stores and connects metadata entities, relationships, quality signals, usage, lineage, ownership, and semantics.

3. **Ingestion Framework and Connectors**  
   A pluggable framework for collecting metadata from databases, warehouses, dashboards, pipelines, messaging systems, ML platforms, storage systems, APIs, and more.

4. **APIs, Search, Events, and Webhooks**  
   Interfaces for consuming, updating, searching, subscribing to, and automating metadata.

5. **MCP and AI SDK**  
   AI-facing tools that expose OpenMetadata context and semantics to assistants, coding agents, and custom LLM applications.

---

## MCP: Connect AI Assistants and Agents

OpenMetadata’s MCP server lets AI assistants and agents interact with your metadata graph through natural language.

Use MCP to give AI assistants governed access to OpenMetadata context, including descriptions, owners, lineage, glossary terms, tags, classifications, data quality results, and semantic search.

### MCP Tools

OpenMetadata MCP tools include:

| Tool | What it does |
| --- | --- |
| `search_metadata` | Search across tables, dashboards, pipelines, topics, glossaries, metrics, and more |
| `semantic_search` | Search by meaning and context beyond keyword matching |
| `get_entity_details` | Retrieve detailed metadata for a specific entity |
| `get_entity_lineage` | Retrieve upstream and downstream lineage for an entity |
| `create_glossary` | Create a new glossary |
| `create_glossary_term` | Create a glossary term |
| `create_lineage` | Create a lineage edge between entities |
| `patch_entity` | Update metadata such as descriptions, tags, and owners |
| `get_test_definitions` | List data quality test definitions |
| `create_test_case` | Create a data quality test case |
| `root_cause_analysis` | Analyze root causes of data quality failures |

### Supported MCP Workflows

OpenMetadata documentation includes setup guides for:

- Claude Desktop
- Claude Code
- Goose
- Cursor
- VS Code
- Semantic Search through MCP

Codex and other MCP-compatible coding agents can use the OpenMetadata MCP endpoint as an external context and tool server.

Get started:
[OpenMetadata MCP Server Documentation](https://docs.open-metadata.org/v1.12.x/how-to-guides/mcp)

### MCP Endpoint

```text
https://<YOUR-OPENMETADATA-SERVER>/mcp
```

### Example Prompts

After connecting an MCP client, try prompts such as:

```text
What is the definition of the Revenue metric?

Show me the lineage of the data feeding the Executive Revenue dashboard.

Who owns the Customer 360 data product and when was it last updated?

Find tables related to customer purchase behavior and transaction history.

Which downstream dashboards are affected if this column changes?

Create a glossary term for Net Retention and link it to related metrics.
```

---

## Semantic Search

Semantic Search lets users and AI assistants find data assets by meaning, not only by exact keyword matches.

When Semantic Search is enabled, OpenMetadata can convert natural-language queries into embeddings and search conceptually related metadata assets.

Example:

```text
Find tables related to customer purchase behavior and transaction history.
```

This can surface assets such as:

```text
order_transactions
buyer_activity
customer_events
revenue_orders
```

Semantic Search helps with:

- natural-language discovery
- AI data exploration
- concept-based search
- cross-domain asset discovery
- finding related data even when names differ
- grounding LLM responses in relevant metadata context

Learn more:
[Semantic Search MCP Tool](https://docs.open-metadata.org/v1.12.x/how-to-guides/mcp/semantic-search)

---

## OpenMetadata Standards

OpenMetadata is built on open metadata standards.

[OpenMetadata Standards](https://openmetadatastandards.org/) is the open-source home for the schemas, ontologies, and specifications behind OpenMetadata.

It provides:

- 700+ JSON Schemas for metadata entities, APIs, configurations, events, and relationships
- RDF/OWL ontologies for semantic web, linked data, and knowledge graph use cases
- SHACL shapes for metadata validation
- JSON-LD contexts for semantic interoperability
- API and event schemas for search, feeds, webhooks, and bulk operations
- standards for governance, lineage, quality, observability, teams, users, roles, policies, and events

OpenMetadata Standards enables:

- interoperable metadata management
- semantic metadata modeling
- enterprise knowledge graph construction
- linked data and RDF integrations
- metadata validation using SHACL
- extensibility through schema-first design

Learn more:
[OpenMetadata Standards](https://openmetadatastandards.org/)

---

## Core Platform Capabilities

### Discovery and Understanding

- asset search and discovery
- semantic search
- descriptions and documentation
- sample data and usage context
- ownership and stewardship
- conversations, tasks, and announcements

### Governance and Semantics

- glossaries and glossary terms
- classifications and tags
- metrics and KPIs
- domains and data products
- policies and roles
- certification and lifecycle states

### Data Quality and Observability

- test cases and test suites
- profiling
- freshness, volume, null, uniqueness, and distribution checks
- custom tests
- data quality dashboards
- alerts and incidents
- root-cause analysis workflows

### Lineage and Impact Analysis

- table lineage
- column-level lineage
- dashboard lineage
- pipeline lineage
- metric lineage
- ML model lineage
- upstream and downstream impact analysis

### Collaboration

- conversations
- tasks
- announcements
- notifications
- ownership workflows
- documentation workflows
- shared stewardship between producers and consumers

### Security and Access Control

- authentication
- authorization
- roles and policies
- SSO integration
- bot and user tokens
- MCP authentication
- governed metadata actions

### Extensibility and Automation

- APIs
- SDKs
- webhooks
- events
- applications
- ingestion framework
- custom connectors
- custom properties
- MCP tools
- AI SDK workflows

---

## Quickstart

### 1. Try OpenMetadata

Explore OpenMetadata using the sandbox:

[OpenMetadata Sandbox](https://sandbox.open-metadata.org)

### 2. Install OpenMetadata

Follow the installation guide:

[OpenMetadata Quickstart](https://docs.open-metadata.org/latest/quick-start)

### 3. Ingest Metadata

Connect your data sources and build your metadata graph.

Start with:

- a warehouse or database
- a BI/dashboard tool
- an orchestration or pipeline system
- data quality and profiling
- lineage ingestion

### 4. Build Context

Add the operational and trust metadata AI needs:

- descriptions
- owners
- teams
- domains
- data products
- quality tests
- freshness checks
- usage
- lineage
- column-level lineage

### 5. Add Semantics

Add business meaning:

- glossaries
- glossary terms
- classifications
- tags
- metrics
- KPIs
- policies
- domains
- data products

### 6. Enable Semantic Search

Configure Semantic Search so users and AI assistants can search by meaning.

Learn more:

```text
https://docs.open-metadata.org/v1.12.x/how-to-guides/mcp/semantic-search
```

### 7. Connect an MCP Client

Install or enable the MCP application in OpenMetadata and connect your preferred MCP-compatible client.

MCP endpoint:

```text
https://<YOUR-OPENMETADATA-SERVER>/mcp
```

MCP guide:

```text
https://docs.open-metadata.org/v1.12.x/how-to-guides/mcp
```

### 8. Build Custom AI Applications

Use the AI SDK to connect any LLM to OpenMetadata’s MCP tools.

AI SDK documentation:

```text
https://docs.open-metadata.org/v1.12.x/api-reference/sdk/ai-sdk
```

---

## Documentation and Community

- Documentation: [docs.open-metadata.org](https://docs.open-metadata.org/)
- MCP Server: [OpenMetadata MCP Documentation](https://docs.open-metadata.org/v1.12.x/how-to-guides/mcp)
- OpenMetadata Standards: [openmetadatastandards.org](https://openmetadatastandards.org/)
- Website: [open-metadata.org](https://open-metadata.org/)
- Slack Community: [slack.open-metadata.org](https://slack.open-metadata.org/)
- Blog: [blog.open-metadata.org](https://blog.open-metadata.org/)

---

## Open Source and Enterprise AI

OpenMetadata is the open-source foundation for metadata, context, semantics, governance, quality, lineage, APIs, MCP, and AI SDK workflows.

For managed enterprise capabilities, AI agents, automation, AI Studio, enterprise MCP workflows, commercial support, and managed operations, see Collate:

- [Collate](https://www.getcollate.io/)
- [Collate AI](https://www.getcollate.io/collate-ai)

---

## Contributing

We welcome contributions from the community.

You can contribute by:

- improving metadata schemas and standards
- adding connectors
- improving ingestion workflows
- enhancing MCP tools
- improving semantic search
- adding documentation
- fixing bugs
- improving the UI and user experience
- proposing new governance, lineage, quality, and AI use cases

See the contribution guide in the repository to get started.

---


## Stargazers

[![Stargazers of @open-metadata/OpenMetadata repo](http://reporoster.com/stars/open-metadata/OpenMetadata)](https://github.com/open-metadata/OpenMetadata/stargazers)

## License
OpenMetadata is released under [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
