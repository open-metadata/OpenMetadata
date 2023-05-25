-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection.secretsManagerCredentials')
where name = 'OpenMetadata';

-- Update the tableau data model enum
UPDATE dashboard_data_model_entity 
SET json = JSON_SET(json, '$.dataModelType', 'TableauDataModel')
WHERE JSON_EXTRACT(json, '$.dataModelType') = 'TableauSheet';