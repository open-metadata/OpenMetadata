-- Update permission for DataConsumer to have ViewMetadata permission.

SET @dataConsumerPolicy = '{
  "name": "DataConsumerRoleAccessControlPolicy-ViewMetadata",
  "userRoleAttr": "DataConsumer",
  "operation": "ViewMetadata",
  "allow": true,
  "enabled": true,
  "priority": 1000
}';

UPDATE policy_entity
SET json = JSON_SET(json, '$.rules', JSON_ARRAY_APPEND(JSON_EXTRACT(json, '$.rules'), '$', CAST(@dataConsumerPolicy AS JSON)))
WHERE fullyQualifiedName = 'DataConsumerRoleAccessControlPolicy';
