# 1.8.0 Release 🎉

{% note noteType="Tip" %}
**24th June 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.8.0!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.8.0-release).

# What's New

OpenMetadata MCP Server — Generative-AI-Ready Metadata with Rich Context

OpenMetadata 1.8 introduces an enterprise-grade MCP (Metadata Context Provider) server, built natively on our unified knowledge graph. This new service delivers a single, high-performance API layer that empowers any Large Language Model—or any downstream application—to access rich, policy-aware context about your data in real time.

## Key highlights:

- One graph, one endpoint: The MCP server exposes every entity, relationship, data quality metric, lineage detail, and governance rule you’ve curated in OpenMetadata.
- LLM-optimized responses: JSON schemas are tailored for semantic search and RAG workflows, enabling chatbots and copilots to ground their answers in accurate, up-to-date metadata.
- Enterprise-grade insights: Gain real-time KPIs on asset distribution, metadata coverage (descriptions, ownership), tiering, and PII tagging to strengthen data governance.
- Zero-friction adoption: It comes bundled with OpenMetadata—just enable the service, generate an API key, and start querying from Claude, Cursor, ChatGPT, and more.

With MCP, every data consumer—from BI analysts to autonomous agents generating SQL—can instantly understand tables, lineage, quality, and ownership without leaving their workflow.

## SCIM Provisioning for Okta & Azure AD — Hands-Free User & Group Management (Collate Only)

Collate 1.8 expands our SSO capabilities with native SCIM 2.0 support for Okta and Azure Active Directory. Now, enterprises can manage the full user lifecycle directly from their Identity Provider—no more CSV uploads or manual role assignments.

### Key benefits:

- Automated onboarding & offboarding: The Tier Agent continuously analyzes usage patterns and lineage to highlight your most critical data assets.
- Consistent governance: The Documentation Agent generates accurate asset descriptions and powers seamless Text2SQL chat experiences.
- Standards-based interoperability: Built on the SCIM spec, making it easy to extend to other IdPs like JumpCloud, OneLogin, and more.

Together with existing SAML/OIDC SSO, SCIM provisioning completes a turnkey identity stack—giving security teams peace of mind while enabling effortless access for data users.

## Data Contracts - API & Specifications

Data-driven teams often struggle with informal agreements around data quality, schema changes, and SLAs. OpenMetadata 1.8 introduces formalized Data Contracts to define and enforce clear, actionable expectations between data producers and consumers.

### Features:

- Schema & Quality Specifications: Define schemas, semantic tags, quality checks, and SLAs explicitly.
- API and UI-driven Management: Easy creation, versioning, and management through both intuitive UI and REST APIs.

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.7.5-release...1.8.0-release)
