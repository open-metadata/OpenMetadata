---
title: page
slug: /main-concepts/metadata-standard/schemas/system/ui/page
---

# Team

*This schema defines the Page entity. A Page is a landing page, schema page to customize in OpenMetadata.*

## Properties

- **`entityType`**: Entity Type. Must be one of: `['Page']`. Default: `Page`.
- **`pageType`**: Refer to *#/definitions/pageType*.
- **`layout`** *(object)*: Configuration for the Knowledge Panel.
- **`tabs`** *(array)*: Tabs included in this page. Default: `[]`.
  - **Items**: Refer to *tab.json*.
- **`persona`**: Persona this page belongs to. Refer to *../../type/entityReference.json*.
- **`domains`**: Domains this page belongs to. Refer to *../../type/entityReferenceList.json*.
- **`knowledgePanels`**: KnowledgePanels that are part of this Page. Refer to *../../type/entityReferenceList.json*.
## Definitions

- **`pageType`** *(string)*: This schema defines the type used for describing different types of pages. Must be one of: `['LandingPage', 'Table', 'StoredProcedure', 'Database', 'DatabaseSchema', 'Topic', 'Pipeline', 'Dashboard', 'DashboardDataModel', 'Container', 'SearchIndex', 'Glossary', 'GlossaryTerm', 'Domain', 'APICollection', 'APIEndpoint', 'Metric', 'MlModel', 'Chart']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
