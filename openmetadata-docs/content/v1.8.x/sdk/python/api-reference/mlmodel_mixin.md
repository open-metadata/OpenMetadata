---
title: ML Model Mixin
slug: /sdk/python/api-reference/mlmodel-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/mlmodel_mixin.py#L0")

# module `mlmodel_mixin`
Mixin class containing Lineage specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/mlmodel_mixin.py#L49")

## class `OMetaMlModelMixin`
OpenMetadata API methods related to MlModel. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/mlmodel_mixin.py#L58")

### method `add_mlmodel_lineage`

```python
add_mlmodel_lineage(
    model: MlModel,
    description: Optional[str] = None
) → Dict[str, Any]
```

Iterates over MlModel's Feature Sources and add the lineage information. :param model: MlModel containing EntityReferences :param description: Lineage description :return: List of added lineage information 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/mlmodel_mixin.py#L97")

### method `get_mlmodel_sklearn`

```python
get_mlmodel_sklearn(
    name: str,
    model,
    description: Optional[str] = None,
    service_name: str = 'scikit-learn'
) → CreateMlModelRequest
```

Get an MlModel Entity instance from a scikit-learn model. 

Sklearn estimators all extend BaseEstimator. :param name: MlModel name :param model: sklearn estimator :param description: MlModel description :param service_name: Service name to use when creating sklearn service :return: OpenMetadata CreateMlModelRequest Entity 




---


