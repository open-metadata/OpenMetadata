INSERT INTO report_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series WHERE extension = 'reportData.reportDataResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'reportData.reportDataResult';