-- Delete SearchIndexingApplication from entity_relationship (via installed_apps)
DELETE er FROM entity_relationship er JOIN installed_apps ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from entity_relationship (via apps_marketplace)
DELETE er FROM entity_relationship er JOIN apps_marketplace ia ON er.fromId = ia.id OR er.toId = ia.id WHERE ia.name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from installed_apps
DELETE FROM installed_apps WHERE name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from apps_marketplace
DELETE FROM apps_marketplace WHERE name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication past runs
DELETE FROM apps_extension_time_series WHERE appname = 'SearchIndexingApplication';
