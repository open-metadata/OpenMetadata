-- DataInsightsApplication should not allow configuration
update apps_marketplace
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';

update installed_apps
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';
