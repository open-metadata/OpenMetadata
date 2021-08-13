---
description: This page provides the overview of API design
---

# Overview

OpenMetadata API is the best way to get metadata in and out of the metadata platform. This section describes the best practices adopted for the API design.

## URI

Following REST API conventions are followed for Resource URIs:

* Operations for an entity are available through the Resource URI as a collection `.../api/<version>/entities`. Plural of the entity name is used as the collection name -  example`.../api/v1/users`.
* Trailing forward slash is not used in the endpoint URI. Example use `.../api/v1/databases` instead of `.../api/v1/databases/`.
* Resource URI for an entity instance by entity `id` is `.../api/v1/entities/{id}`. Resource URI for an entity instance by name is `.../api/v1/entities/name/{name}`. 

## Resource representation

* The REST API calls return a response with JSON `Content-Type` and `Content-Length`  that includes the length of the response.
* All responses include the Resource ID field even though the `id` was provided in the request to simplify the consumption of the response at the client.
* Entity names and field names use camelCase per Javascript naming convention.
* All resources include an attribute  `href` with Resource URI. All relationship fields of an entity will also include `href` link to the related resource for easy access.
* Unknown fields sent by the client in API requests **are not ignored** to ensure the data sent by the client is not dropped at the server without the user being aware of it. 

## HTTP methods

Following HTTP methods are supported for CRUD operations. HTTP response codes are used per REST API conventions.

| HTTP Methods | Response |
| :--- | :--- |
| GET .../api/v1/entities | List entities |
| GET .../api/v1/entities/{id} | Get an entity by id |
| GET .../api/v1/entities/name/{name} | Get an entity by name |
| POST .../api/v1/entities | Create an entity |
| PUT .../api/v1/entities/{id} | Create or update an entity |
| PATCH .../api/v1/entities/{id} | Update an entity using [JSONPatch](http://jsonpatch.com/) |
| DELETE .../api/v1/entities/{id} | Delete an entity |

## GET Operations

### Listing entities

GET operation returns a list of entities as shown below:

```text
GET /v1/tables
```

```javascript
200 OK

{
  “data” : [
    {
      “id”: “123e4567-e89b-42d3-a456-556642440000”
      “name”: “dim_user”,
      “documentation” : “This table has user information...”
    },
    {
      “id”: “4333e4567-e89b-42d3-a456-556642440000”
      “name”: “fact_sales”,
      “documentation” : “This table has sales information...”
    }
    ...
  ],
  "paging" : {
    "before" : null
    "after" : "2yXqpvzRNGUE"
  }
}
```

#### Cursor-based pagination

List API requests may return a large number of results in a single response. Cursor-based pagination is supported to manage the number of results.

```text
GET /v1/tables?limit=10&after=2yXqpvzRNGUE
```

```javascript
200 OK

{
  “data” : [
    ...
  ],
  "paging" : {
    "before" : "2ySdOiNaz",
    "after" : "2uiGDWxz=UV"
  }
}
```

* `before`: This cursor points to the start of the page of data that has been returned. Use the `before` cursor returned in the result in a subsequent request to scroll backward. When response returns `before` as `null`, backward scrolling stops and you are at the beginning of the list.
* `after`: This cursor points to the end of the page of data that has been returned. Use the `after` cursor returned in the result in a subsequent request to scroll backward. When response returns `after` as `null`, forward scrolling stops and you are at the end of the list.
* `limit`: This is the maximum number of objects that may be returned. 

### Getting an entity by `id` or `name`

Using an identifier to identify a resource is a stable and unambiguous way of accessing the resource. Additionally, all resources support getting a resource by fully-qualified-name as shown below. These URLs are not stable and may not remain valid if the name of the entity changes.

```text
GET /v1/tables/123e4567-e89b-42d3-a456-556642440000
```

```text
GET /v1/tables/name/service.database.dim_user
```

```javascript
200 OK
{
  “id”: “123e4567-e89b-42d3-a456-556642440000”
  “name”: “dim_user”,
  “documentation” : “This table has user information...”
  “columns” : [
    “column1”: {
      ...
    },
    “column2”: {
      ...
    }
    ...
  ]
  ...
}
```

### Getting entities with only necessary fields

To GET an entity with only necessary fields, pass `fields` query parameter while listing or getting an entity. This helps clients control the amount of data returned in the response. Some fields may be included by default whether `fields` specifies them or not \(example - id and name fields below\):

```text
GET /v1/tables/123e4567-e89b-42d3-a456-556642440000?fields=columns,tableConstraints,usage
```

```javascript
200 OK
{
  “id”: “123e4567-e89b-42d3-a456-556642440000”
  “name”: “dim_user”,
  “documentation” : “This table has user information...”
  "columns": ...
  "usage": ...
  "tableConstraints": ...
}
```

## POST

HTTP POST method is used for creating new entities.

```javascript
POST http://localhost:8585/api/v1/users
{
  “name”: “user@domain.com”
}
```

```javascript
201 Created
content-length: 151
content-type: application/json
{
  "id": "6feb5287-f3c5-457f-86ae-95bcfb82e867",
  "name": "user@domain.com",
  "href": "http://localhost:8585/api/v1/users/6feb5287-f3c5-457f-86ae-95bcfb82e867"
}
```

* POST request usually takes a simpler **request object** with a smaller subset of fields compared to the entity object that could include lot more fields to keep the APIs simple.
* Required fields in the request object are marked in the corresponding JSON schema.
* When an entity is created, `201 Created` response is returned along with Entity data as JSON content.

## PUT

A PUT request is used to update an entity or create an entity when it does not exist.

```javascript
PUT http://localhost:8585/api/v1/users

{
  “name”: “user@domain.com”
}
```

```javascript
201 Created
content-length: 151
content-type: application/json
{
  "id": "6feb5287-f3c5-457f-86ae-95bcfb82e867",
  "name": "user@domain.com",
  "href": "http://localhost:8585/api/v1/users/6feb5287-f3c5-457f-86ae-95bcfb82e867"
}
```

* PUT request usually takes a simpler **request object** with a smaller subset of fields compared to the entity object that could include lot more fields to keep the APIs simple.
* Required fields in the request object are marked in the JSON schema.
* When an entity is created, `201 Created` response is returned. If the entity already exists, the entity is replaced based on the PUT request and `200 OK` response is returned. Both responses include entity data as JSON content.

## PATCH

PATCH request is used for updating an existing entity by sending a JSON patch document in the request.

```text
PATCH http://localhost:8585/api/v1/users

[
  { "op": "replace", "path": "/displayName", "value": "First Last" },
  { "op": "remove", "path": "/owns/0" }
]
```

```javascript
200 OK
{
  "id": "6feb5287-f3c5-457f-86ae-95bcfb82e867",
  "name": "user@domain.com",
  "href": "http://localhost:8585/api/v1/users/6feb5287-f3c5-457f-86ae-95bcfb82e867",
  “displayName” : “First Last”
}
```

* Client first gets Entity using a `GET` request. The fields are then updated with the new values. The JSON patch is generated by diffing the original and the updated JSON documents.
* JSON diff is sent using a `PATCH` request.
* When the diff is successfully applied on the server, `200 OK` response is returned along with the updated entity data as content.

## DELETE

DELETE request is used for deleting an existing entity. On successful deletion, the server returns `200 OK` response.

```text
DELETE http://localhost:8585/api/v1/users/6feb5287-f3c5-457f-86ae-95bcfb82e867
```

```text
200 OK
```



