-- Remove SearchIndexing for api Service, collection and endpoint
DELETE er FROM entity_relationship er JOIN installed_apps ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name  =  'SearchIndexingApplication';
DELETE er FROM entity_relationship er JOIN apps_marketplace ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name  =  'SearchIndexingApplication';
DELETE from installed_apps where name  =  'SearchIndexingApplication';
DELETE from apps_marketplace where name  =  'SearchIndexingApplication';