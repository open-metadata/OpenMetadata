-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';

-- Update the tableau data model enum
UPDATE dashboard_data_model_entity
SET json = JSONB_SET(json::jsonb, '{dataModelType}', '"TableauDataModel"')
WHERE json#>'{dataModelType}' = '"TableauSheet"';
