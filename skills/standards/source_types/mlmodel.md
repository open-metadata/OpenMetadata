# ML Model Connector Standards

## Base Class
`MlModelServiceSource` in `ingestion/src/metadata/ingestion/source/mlmodel/mlmodel_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/mlmodel/mlflow/`

## Entity Hierarchy
```
MlModelService → MlModel → MlFeature
                          → MlHyperParameter
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `yield_mlmodel(model_details)` | Create ML model entity with features and hyperparameters |

## Schema Properties
- `trackingUri` or `hostPort`
- Auth (token or basic)
- `supportsMetadataExtraction`
