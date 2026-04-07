# Code Style Standards

## Python

### Imports
Order: stdlib → third-party → OpenMetadata generated → OpenMetadata internal

```python
import json
import traceback
from functools import partial
from typing import Iterable, Optional

import requests
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.myDbConnection import (
    MyDbConnection,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.connections.connection import BaseConnection
from metadata.utils.logger import ingestion_logger
```

### Naming
- Connector directory: `snake_case` (e.g., `my_database`)
- Python classes: `PascalCase` (e.g., `MyDatabaseSource`)
- JSON Schema file: `lowerCamelCase` + `Connection.json` (e.g., `myDatabaseConnection.json`)
- Type enum: `PascalCase` (e.g., `MyDatabase`)

### Type Annotations
- All function signatures must have type annotations
- Use `Optional[T]` for nullable fields
- Use `Iterable[Either[...]]` for yield methods
- Import types from `typing` or `collections.abc`

### No Unnecessary Comments
- Do NOT add comments that describe what code obviously does
- Only comment complex business logic, non-obvious algorithms, or workarounds
- No Google-style docstrings with `Args:` / `Returns:` on simple methods
- If code needs a comment to be understood, refactor the code instead

### Pydantic Models

When defining Pydantic models for API responses with aliased fields:
- Always set `model_config = ConfigDict(populate_by_name=True)` when using `Field(alias=...)` — without it, constructing instances with Python attribute names raises `ValidationError`
- Use `Optional[T]` with `Field(None, alias=...)` for nullable fields
- Create list response wrapper models inheriting from a base OData/pagination response

```python
from pydantic import BaseModel, ConfigDict, Field

class MyApiReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="Id")
    name: str = Field(alias="Name")
    description: Optional[str] = Field(None, alias="Description")


class MyApiListResponse(BaseModel):
    value: List[MyApiReport] = Field(default_factory=list)
```

### Error Messages
Include context in error messages:

```python
# Good
raise ValueError(f"Cannot connect to {config.hostPort}: {exc}")

# Bad
raise ValueError("Connection failed")
```

## JSON Schema

### File Naming
Schema file names use `lowerCamelCase`:
- `myDatabaseConnection.json` (not `my_database_connection.json`)
- `bigQueryConnection.json` (not `big_query_connection.json`)

### Required Fields
Every connection schema must have:
- `$id` with full URI path
- `$schema`: `http://json-schema.org/draft-07/schema#`
- `title`: PascalCase connection name
- `javaType`: Full Java class path
- `type`: `"object"`
- `definitions` block with type enum
- `additionalProperties: false`

### Property Conventions
- Use `title` for UI labels
- Use `description` for help text
- Use `format: "password"` for secrets
- Use `format: "uri"` for URLs
- Use `default` values where sensible
- Use `$ref` to compose from shared schemas

### $ref Paths
Paths are relative from the schema file location:
- Auth: `./common/basicAuth.json`
- SSL: `../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig`
- Filters: `../../../../type/filterPattern.json#/definitions/filterPattern`
- Connection extras: `../connectionBasicType.json#/definitions/connectionOptions`
- Capability flags: `../connectionBasicType.json#/definitions/supportsMetadataExtraction`

## Copyright Header

All Python files must start with:

```python
#  Copyright 2025 OpenMetadata
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
```

## Formatting

- Python: `black` + `isort` + `pycln` (run `make py_format`)
- Java: `spotless` (run `mvn spotless:apply`)
- Line length: 88 (black default)

**Always run formatting before committing**:
```bash
source env/bin/activate
make py_format
mvn spotless:apply
```

If `make py_format` fails because tools are not installed:
```bash
source env/bin/activate
make install_dev generate
make py_format
```

## Pre-Merge Cleanup

`CONNECTOR_CONTEXT.md` is gitignored and stays local — no action needed for that file.

Before submitting a PR, verify:
- No scaffolding artifacts are staged (check `git status` — CONNECTOR_CONTEXT.md should not appear)
- Remove any `TODO` comments that are implementation instructions (keep only genuine future-work TODOs with ticket references)
- Remove any temporary test fixtures or mock data files that aren't part of the test suite
