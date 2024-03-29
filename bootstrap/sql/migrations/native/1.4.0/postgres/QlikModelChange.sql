-- Migrate 'QlikSenseDataModel' & 'QlikCloudDataModel' into single entity 'QlikDataModel'

UPDATE dashboard_data_model_entity
SET json = jsonb_set(
            json, 
            '{dataModelType}', 
            '"QlikDataModel"', 
            true
        )
WHERE json->>'dataModelType' IN ('QlikSenseDataModel', 'QlikCloudDataModel');
