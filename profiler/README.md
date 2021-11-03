---
This guide will help you setup the Data Profiler
---

![Python version 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

OpenMetadata Data profiler to collect measurements on various data sources
publishes them to OpenMetadata. This framework runs the tests and profiler

**Prerequisites**

- Python &gt;= 3.8.x

### Install From PyPI

```text
python3 -m pip install --upgrade pip wheel setuptools openmetadata-dataprofiler
```

#### Generate Redshift Data

```text
openmetadata profiler -c ./examples/workflows/redshift.json
```

