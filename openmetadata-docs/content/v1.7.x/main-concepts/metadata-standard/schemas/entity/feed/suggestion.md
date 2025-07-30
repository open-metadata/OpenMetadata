---
title: Suggestion Schema | OpenMetadata Suggestion
description: Store suggestions in feed for metadata edits, enrichment, or governance recommendations.
slug: /main-concepts/metadata-standard/schemas/entity/feed/suggestion
---

# Suggestion

*This schema defines the Suggestion entity. A suggestion can be applied to an asset to give the owner context about possible changes or improvements to descriptions, tags,...*

## Properties

- **`id`**: Unique identifier that identifies an entity instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`type`**: Refer to *[#/definitions/suggestionType](#definitions/suggestionType)*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`entityLink`**: Data asset about which this thread is created for with format <#E::{entities}::{entityName}::{field}::{fieldValue}. Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.
- **`createdAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`createdBy`**: User or Bot who made the suggestion. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`updatedAt`**: Last update time corresponding to the update version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User or Bot who updated the suggestion.
- **`status`**: Refer to *[#/definitions/suggestionStatus](#definitions/suggestionStatus)*.
- **`description`** *(string)*: The main message of the thread in Markdown format.
- **`tagLabels`** *(array)*: Tags or Glossary Terms. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
## Definitions

- **`suggestionType`** *(string)*: Type of a Suggestion. Must be one of: `["SuggestDescription", "SuggestTagLabel"]`.
- **`suggestionStatus`** *(string)*: Status of a Suggestion. Must be one of: `["Open", "Accepted", "Rejected"]`. Default: `"Open"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
