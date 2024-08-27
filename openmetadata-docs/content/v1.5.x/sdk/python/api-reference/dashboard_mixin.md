---
title: Dashboard Mixin
slug: /sdk/python/api-reference/dashboard-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/dashboard_mixin.py#L0")

# module `dashboard_mixin`
Mixin class containing Table specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/dashboard_mixin.py#L25")

## class `OMetaDashboardMixin`
OpenMetadata API methods related to Dashboards and Charts. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/dashboard_mixin.py#L34")

### method `publish_dashboard_usage`

```python
publish_dashboard_usage(
    dashboard: Dashboard,
    dashboard_usage_request: UsageRequest
) → None
```

POST usage details for a Dashboard 

:param dashboard: Table Entity to update :param dashboard_usage_request: Usage data to add 




---


