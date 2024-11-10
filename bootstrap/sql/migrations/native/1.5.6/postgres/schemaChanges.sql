-- Delete Search Indexing Application 
DELETE FROM  entity_relationship er  USING installed_apps ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name = 'SearchIndexingApplication';
DELETE FROM  entity_relationship er  USING apps_marketplace ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name = 'SearchIndexingApplication';
DELETE FROM  installed_apps where name = 'SearchIndexingApplication';
DELETE FROM  apps_marketplace where name = 'SearchIndexingApplication';