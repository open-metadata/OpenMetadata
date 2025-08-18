---
title: createSuggestion
slug: /main-concepts/metadata-standard/schemas/api/feed/createsuggestion
---

# CreateSuggestionRequest

*Create Suggestion request*

## Properties

- **`description`** *(string)*: Message in Markdown format. See markdown support for more details.
- **`tagLabels`** *(array)*: Tags or Glossary Terms. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`type`**: Refer to *../../entity/feed/suggestion.json#/definitions/suggestionType*.
- **`entityLink`**: Data asset about which this thread is created for with format <#E::{entities}::{entityName}::{field}::{fieldValue}. Refer to *../../type/basic.json#/definitions/entityLink*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
