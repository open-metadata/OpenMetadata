-- Remove SearchIndexing for api Service, collection and endpoint
DELETE FROM entity_relationship er USING installed_apps ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name  =  'SearchIndexingApplication';
DELETE FROM entity_relationship er USING apps_marketplace ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name  =  'SearchIndexingApplication';
DELETE from installed_apps where name  =  'SearchIndexingApplication';
DELETE from apps_marketplace where name  =  'SearchIndexingApplication';