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
- **`persona`**: Persona this page belongs to. Refer to *../../type/entityReference.json*.
- **`domain`**: Domain this page belongs to. Refer to *../../type/entityReference.json*.
- **`knowledgePanels`**: KnowledgePanels that are part of this Page. Refer to *../../type/entityReferenceList.json*.
## Definitions

- **`pageType`** *(string)*: This schema defines the type used for describing different types of pages. Must be one of: `['LandingPage', 'TableLandingPage', 'StoredProcedureLandingPage', 'DatabaseLandingPage', 'DatabaseSchemaLandingPage', 'TopicLandingPage', 'PipelineLandingPage', 'DashboardLandingPage', 'DashboardDataModelLandingPage', 'ContainerLandingPage', 'SearchIndexLandingPage', 'GlossaryLandingPage', 'GlossaryTermLandingPage', 'DomainLandingPage']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
