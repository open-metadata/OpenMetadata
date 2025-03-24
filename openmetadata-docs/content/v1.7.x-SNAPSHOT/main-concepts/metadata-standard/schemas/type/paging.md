---
title: paging
slug: /main-concepts/metadata-standard/schemas/type/paging
---

# Paging

*Type used for cursor based pagination information in GET list responses.*

## Properties

- **`before`** *(string)*: Before cursor used for getting the previous page (see API pagination for details).
- **`after`** *(string)*: After cursor used for getting the next page (see API pagination for details).
- **`offset`** *(integer)*: Offset used in case of offset based pagination. Default: `null`.
- **`limit`** *(integer)*: Limit used in case of offset based pagination. Default: `null`.
- **`total`** *(integer)*: Total number of entries available to page through.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
