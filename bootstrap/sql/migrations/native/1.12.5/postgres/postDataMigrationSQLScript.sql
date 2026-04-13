-- Delete SearchIndexingApplication from entity_relationship (via installed_apps)
DELETE FROM entity_relationship er USING installed_apps ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from entity_relationship (via apps_marketplace)
DELETE FROM entity_relationship er USING apps_marketplace ia WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from installed_apps
DELETE FROM installed_apps WHERE name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication from apps_marketplace
DELETE FROM apps_marketplace WHERE name = 'SearchIndexingApplication';

-- Delete SearchIndexingApplication past runs
DELETE FROM apps_extension_time_series WHERE appname = 'SearchIndexingApplication';
