-- Update widget description
UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Aggregates platform activity including asset updates, comments, and task changes, keeping users informed.')
WHERE name = 'ActivityFeed' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Allows admins to create customized lists of high-impact asset views by applying filters. Ideal for curating datasets relevant to specific user groups.')
WHERE name = 'CuratedAssets' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Highlights data assets across the platform for quicker access to frequently used or high-value datasets.')
WHERE name = 'DataAssets' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Lists data assets that the user is actively following and provides quick access.')
WHERE name = 'Following' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Visualizes key performance metrics of data assets in an intuitive graph format.')
WHERE name = 'KPI' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Shows recently viewed data assets for quick access and seamless continuation of work.')
WHERE name = 'MyData' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Displays a real-time feed of assigned tasks to help users track and manage their workload efficiently.')
WHERE name = 'MyTask' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Shows the total number of data assets that can be accessed, gives a quick view of what''s available in the system.')
WHERE name = 'TotalAssets' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Displays all available domains to explore and access data grouped by specific data assets.')
WHERE name = 'Domains' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Presents an overview of data quality test result status and links to access incidents.')
WHERE name = 'DataQuality' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Quick access for recently viewed or edited articles, policies, and guidelines for team-wide clarity.')
WHERE name = 'KnowledgeCenter' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = JSON_SET(json, '$.description',
  'Lists active or recent data pipeline executions with status and progress of data flows.')
WHERE name = 'PipelineStatus' AND entityType = 'KnowledgePanel';