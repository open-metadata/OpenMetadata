# Practical Guide to ML Model Governance in OpenMetadata

Enterprise Machine Learning models require strict governance tracking—connecting training data lineage, evaluation metrics, and version changes for regulatory compliance.

---

## 1. Governance Requirements for ML
Traditional software relies on Git versioning, but ML models depend on both **code and data**. 

Key regulatory compliance standards require:
- **Data Provenance:** Tracing exact training datasets back to upstream data pipelines.
- **Model Explainability:** Recording evaluation metrics alongside active model versions.
- **Audit Trails:** Maintaining historical logs of retrains and parameter shifts.

---

## 2. Defining an ML Model Entity
In OpenMetadata, define an `MlModel` entity to catalog your model service:

- **Name / FQN:** `payment_fraud_classifier` 
- **Algorithm:** `XGBoost`
- **Owner:** ML Engineering / Data Science
- **Description:** Classification model deployed to evaluate real-time payment transaction risk.

---

## 3. Linking Training Data Lineage
1. Open your `MlModel` entity in OpenMetadata.
2. Select the **Lineage** tab.
3. Add upstream links from your feature store tables (e.g., `fraud_features_v1`) directly to the model entity to establish end-to-end data provenance.

---

## 4. Storing Evaluation Metrics as Custom Properties
Record model validation results as metadata fields for cross-team visibility:

| Metric | Target | Description |
| :--- | :--- | :--- |
| `Precision` | `0.94` | False positive control |
| `Recall` | `0.89` | Fraud capture rate |
| `PR-AUC` | `0.91` | Overall performance threshold |

---

## 5. Model Versioning & Alert Workflows
- **Version Tracking:** Increment model versions (e.g., `v1.0.0` -> `v1.1.0`) whenever retraining alters feature schema or baseline metrics.
- **Automated Alerts:** Configure OpenMetadata webhooks to alert compliance teams when critical model attributes or upstream data sources change.