-- Migrate 'QlikSenseDataModel' & 'QlikCloudDataModel' into single entity 'QlikDataModel'

UPDATE dashboard_data_model_entity
SET json = JSON_SET(json, '$.dataModelType', 'QlikDataModel')
WHERE JSON_EXTRACT(json, '$.dataModelType') in ('QlikSenseDataModel', 'QlikCloudDataModel');
