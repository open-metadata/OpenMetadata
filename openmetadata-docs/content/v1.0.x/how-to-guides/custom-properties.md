---
title: How to add a custom property to an entity
slug: /how-to-guides/how-to-add-custom-property-to-an-entity
---

# How to add a custom property to an entity with API

This tutorial will create a custom property for a `table` entity.

Let's assume in your organization you want to keep track of table size, so to achieve that you will be creating a custom property for table entities and then providing a value to that property for each table.

### Step 1: Get the table entity type.

All OpenMetadata APIs are secured so make sure to add the proper headers.

```commandline
curl -X GET http://localhost:8585/api/v1/metadata/types/name/table
```

After the API call, you will get a response like this.

```json
{
  "id": "7f0b032f-cdc8-4573-abb0-22165dcd8e07",
  "name": "table",
  "customProperties": [
    {
      "name": "tableSize",
      "description": "Property for tracking the tableSize.",
      "propertyType": {
        "id": "7531f881-c37c-4e39-9154-4bdf0802e05e",
        "type": "type",
        "name": "string",
        "fullyQualifiedName": "string",
        "description": "\"A String type.\"",
        "displayName": "string",
        "href": "http://localhost:8585/api/v1/metadata/types/7531f881-c37c-4e39-9154-4bdf0802e05e"
      }
    }
  ]
}
```

Now take the `id` from above response `7f0b032f-cdc8-4573-abb0-22165dcd8e07`.

### Step 2: Get the field types with `category=field`

> From UI OpenMetadata only supports three field types
>
> - String
> - Markdown
> - Integer

```commandline
 curl -X GET http://localhost:8585/api/v1/metadata/types?category=field
```

This API will return all the available field types, for this tutorial grab the id of the `string` field type. i.e `7531f881-c37c-4e39-9154-4bdf0802e05e`

### Step 3: Make a PUT call to create the custom property for the table entity

```commandline
curl -X PUT http://localhost:8585/api/v1/metadata/types/7f0b032f-cdc8-4573-abb0-22165dcd8e07
```

**Payload**

```json
{
  "description": "Property for tracking the tableSize.",
  "name": "tableSize",
  "propertyType": {
    "id": "7531f881-c37c-4e39-9154-4bdf0802e05e",
    "type": "type"
  }
}
```

### Step 4: Get the custom properties for the table entity

```commandline
curl -X GET http://localhost:8585/api/v1/metadata/types/name/table?fields=customProperties
```

**Response**

```json
{
  "id": "7f0b032f-cdc8-4573-abb0-22165dcd8e07",
  "name": "table",
  "customProperties": [
    {
      "name": "tableSize",
      "description": "Property for tracking the tableSize.",
      "propertyType": {
        "id": "7531f881-c37c-4e39-9154-4bdf0802e05e",
        "type": "type",
        "name": "string",
        "fullyQualifiedName": "string",
        "description": "\"A String type.\"",
        "displayName": "string",
        "href": "http://localhost:8585/api/v1/metadata/types/7531f881-c37c-4e39-9154-4bdf0802e05e"
      }
    }
  ]
}
```

So for all table entities, we have `tableSize` custom property available now, let’s add the value for it for the `raw_product_catalog` table.

### Step 5: Add/Edit the value of the custom property for the entity.

All the custom properties value for the entity will be stored in the `extension` attribute.

Let’s assume you have `raw_product_catalog` table and its id is `208598fc-bd5f-458c-bf98-59224e1620c7` so our PATCH API request will be like this.

```commandline
curl -X PATCH http://localhost:8585/api/v1/tables/208598fc-bd5f-458c-bf98-59224e1620c7 -H 'Content-Type: application/json-patch+json'
```

For the first time if we want to add the value to the custom property then the payload should be like this.

```json
[
  {
    "op": "add",
    "path": "/extension",
    "value": {
      "tableSize": "50GB"
    }
  }
]
```

When Changing the value of the custom property payload should be like this,

```json
[
  {
    "op": "replace",
    "path": "/extension/tableSize",
    "value": "60GB"
  }
]
```
