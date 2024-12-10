---
title: Client
slug: /sdk/python/api-reference/client
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L0")

# module `client`
Python API REST wrapper and helpers 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L29")

## class `RetryException`
API Client retry exception 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L35")

## class `APIError`
Represent API related error. error.status_code will have http status code. 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L41")

### method `__init__`

```python
__init__(error, http_error=None)
```






---

#### property code

Return error code 

---

#### property request

Handle requests error 

---

#### property response

Handle response error :return: 

---

#### property status_code

Return response status code 



**Returns:**
  int 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L89")

## class `ClientConfig`
:param raw_data: should we return api response raw or wrap it with  Entity objects. 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L111")

## class `REST`
REST client wrapper to manage requests with retries, auth and error handling. 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L117")

### method `__init__`

```python
__init__(config: ClientConfig)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L324")

### method `close`

```python
close()
```

Close requests session 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L308")

### method `delete`

```python
delete(path, data=None)
```

DELETE method 



**Parameters:**
  path (str):  data (): 



**Returns:**
  Response 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L251")

### method `get`

```python
get(path, data=None)
```

GET method 



**Parameters:**
  path (str):  data (): 



**Returns:**
  Response 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L290")

### method `patch`

```python
patch(path, data=None)
```

PATCH method 



**Parameters:**
  path (str):  data (): 



**Returns:**
  Response 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L264")

### method `post`

```python
post(path, data=None)
```

POST method 



**Parameters:**
  path (str):  data (): 



**Returns:**
  Response 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client.py#L277")

### method `put`

```python
put(path, data=None)
```

PUT method 



**Parameters:**
  path (str):  data (): 



**Returns:**
  Response 




---


