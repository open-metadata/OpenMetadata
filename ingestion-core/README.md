---
This guide will help you set up OpenMetadata Core Models
---

![Python version 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

These models are `pydantic` models automatically generated from the
central JSON Schemas that define our APIs and Entities.

**Prerequisites**

- Python &gt;= 3.8.x

### Docs

Please refer to the documentation here https://docs.open-metadata.org/connectors

### Contribution

In order to contribute to this package:

```bash
cd ingestion-core
python -m virtualenv venv
source venv/bin/activate
python -m pip install ".[dev]"
```

> OBS: During development we might need to treat this in a different
  virtual environment if we are yet to update the reference to the core
  package in `openmetadata-ingestion`.
