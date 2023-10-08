-- Update the tableau data model enum
UPDATE dashboard_data_model_entity
SET json = JSONB_SET(json::jsonb, '{dataModelType}', '"TableauDataModel"')
WHERE json#>'{dataModelType}' = '"TableauSheet"';