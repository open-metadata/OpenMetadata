---
title: page
slug: /main-concepts/metadata-standard/schemas/system/ui/page
---

# Team

*This schema defines the Page entity. A Page is a landing page, schema page to customize in OpenMetadata.*

## Properties

- **`entityType`**: Entity Type. Must be one of: `["Page"]`. Default: `"Page"`.
- **`pageType`**: Refer to *[#/definitions/pageType](#definitions/pageType)*.
- **`layout`** *(object)*: Configuration for the Knowledge Panel.
- **`tabs`** *(array)*: Tabs included in this page. Default: `[]`.
  - **Items**: Refer to *[tab.json](#b.json)*.
- **`persona`**: Persona this page belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`domain`**: Domain this page belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`knowledgePanels`**: KnowledgePanels that are part of this Page. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
## Definitions

- **`pageType`** *(string)*: This schema defines the type used for describing different types of pages. Must be one of: `["LandingPage", "Table", "StoredProcedure", "Database", "DatabaseSchema", "Topic", "Pipeline", "Dashboard", "DashboardDataModel", "Container", "SearchIndex", "Glossary", "GlossaryTerm", "Domain"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
