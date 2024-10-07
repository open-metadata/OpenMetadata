---
title: Search Ranking Signals in OpenMetadata
slug: /how-to-guides/data-discovery/search
---

# Search Ranking in OpenMetadata

OpenMetadata uses an advanced ranking mechanism to prioritize search results, ensuring that the most relevant information is displayed to users based on the search query. This process involves the `FunctionScoreQueryBuilder`, which applies weights to specific fields in different entities, allowing the system to control the importance of each field during the search ranking process.

## Overview of Search Ranking Mechanism

When users perform a search in OpenMetadata, the system ranks the entities based on their relevance. This relevance is computed using the `FunctionScoreQueryBuilder`, which assigns different weights to fields within each entity. The higher the weight, the more influence the field has in determining the relevance of the search result.

## Default Field Weights

By default, OpenMetadata applies a set of predefined weightings across all entities. These weights reflect the significance of different attributes in determining the relevance of an entity and are not customizable. The following weights are applied globally:

| Field                                    | Weight (Factor) |
|------------------------------------------|-----------------|
| `tier.tagFQN` ("Tier.Tier1")             | 50              |
| `tier.tagFQN` ("Tier.Tier2")             | 30              |
| `tier.tagFQN` ("Tier.Tier3")             | 15              |
| `usageSummary.weeklyStats.count`         | 4               |
| `totalVotes`                             | 4               |

These fields serve as the foundation for ranking entities, with higher-tier tags (Tier1) and user interactions (like votes and usage statistics) playing a critical role in boosting the ranking of a search result.

## How Search Ranking is Applied

The search process in OpenMetadata works as follows:

1. **Search Query Execution**: The user enters a search query, which is passed into the `FunctionScoreQueryBuilder`.
2. **Field Weighting**: For each entity, global default fields are multiplied by their associated weights (as specified above).
3. **Score Calculation**: The system calculates a score for each entity based on field matches and their respective weights.
4. **Result Ranking**: Entities are sorted in descending order of their scores, with higher scores indicating more relevant results.

## Practical Example

Suppose a user searches for "customer data" in OpenMetadata, and there are two entities:

{% image
  src="/images/v1.6/how-to-guides/search/search-result.png"
/%}

- `stg_customers` has no tier and a high `usageSummary.weeklyStats.count`.
- Entity B has `Tier.Tier1` and very low usage statistics.

In this case, `stg_customers`, with a higher usage count, will likely appear first in the search results due to the stronger influence of the `usageSummary.weeklyStats.count`.

## Key Points to Remember

- **Global Weights**: Applied to all entities, these provide a baseline ranking based on critical attributes like tier tags and usage statistics.
- **Entity-Specific Weights**: Fine-tune ranking based on the entity type (e.g., Table, Topic), focusing on important fields within that entity.
