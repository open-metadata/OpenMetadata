---
title: statusContext
slug: /main-concepts/metadata-standard/schemas/events/statuscontext
---

# FailedEvents

*Status Context*

## Properties

- **`statusCode`** *(integer)*: HTTP status code of the response.
- **`statusInfo`** *(string)*: Reason phrase associated with the status code.
- **`headers`**: Response headers as a map.
- **`entity`** *(string)*: Response entity, if available.
- **`mediaType`** *(string)*: Media type of the response.
- **`location`** *(string)*: Location URI from the response.
- **`timestamp`**: Time in milliseconds since epoch. Refer to *../type/basic.json#/definitions/timestamp*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
