# Paging

Type used for cursor based pagination information in GET list responses.

**$id: https://open-metadata.org/schema/type/paging.json**

Type: `object`

## Properties
 - **before**
   - Before cursor used for getting the previous page (see API pagination for details).
   - Type: `string`
 - **after**
   - After cursor used for getting the next page (see API pagination for details).
   - Type: `string`
 - **total** `required`
   - Total number of entries available to page through.
   - Type: `integer`

_This document was updated on: Thursday, October 14, 2021_