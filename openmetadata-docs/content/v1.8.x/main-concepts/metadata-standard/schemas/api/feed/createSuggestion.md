---
title: Create Suggestion API | OpenMetadata Suggestion API
slug: /main-concepts/metadata-standard/schemas/api/feed/createsuggestion
---

# CreateSuggestionRequest

*Create Suggestion request*

## Properties

- **`description`** *(string)*: Message in Markdown format. See markdown support for more details.
- **`tagLabels`** *(array)*: Tags or Glossary Terms. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`type`**: Refer to *[../../entity/feed/suggestion.json#/definitions/suggestionType](#/../entity/feed/suggestion.json#/definitions/suggestionType)*.
- **`entityLink`**: Data asset about which this thread is created for with format <#E::{entities}::{entityName}::{field}::{fieldValue}. Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
