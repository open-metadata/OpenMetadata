-- Delete Search Indexing Application 
DELETE er FROM  entity_relationship er JOIN installed_apps ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name = 'SearchIndexingApplication';
DELETE er FROM  entity_relationship er JOIN apps_marketplace ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name = 'SearchIndexingApplication';
DELETE FROM  installed_apps where name = 'SearchIndexingApplication';
DELETE FROM  apps_marketplace where name = 'SearchIndexingApplication';