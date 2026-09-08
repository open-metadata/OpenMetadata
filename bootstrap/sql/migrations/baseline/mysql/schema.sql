-- Consolidated OpenMetadata migration baseline (MySQL)
-- Covers: flyway v000-v015 + native 1.1.0-1.13.4 (everything strictly below 2.0.0)
-- Generated from git revision: b07117a765466d3fd12c3179ac800bc734de0a5f
-- Regenerate with: scripts/generate_migration_baseline.sh
-- FROZEN: never edit by hand; schema changes go into bootstrap/sql/migrations/native/2.1.0+.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `QRTZ_BLOB_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `BLOB_DATA` blob,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  KEY `SCHED_NAME` (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  CONSTRAINT `QRTZ_BLOB_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`) REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_CALENDARS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `CALENDAR_NAME` varchar(190) NOT NULL,
  `CALENDAR` blob NOT NULL,
  PRIMARY KEY (`SCHED_NAME`,`CALENDAR_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_CRON_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `CRON_EXPRESSION` varchar(120) NOT NULL,
  `TIME_ZONE_ID` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  CONSTRAINT `QRTZ_CRON_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`) REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_FIRED_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `ENTRY_ID` varchar(95) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `INSTANCE_NAME` varchar(190) NOT NULL,
  `FIRED_TIME` bigint NOT NULL,
  `SCHED_TIME` bigint NOT NULL,
  `PRIORITY` int NOT NULL,
  `STATE` varchar(16) NOT NULL,
  `JOB_NAME` varchar(190) DEFAULT NULL,
  `JOB_GROUP` varchar(190) DEFAULT NULL,
  `IS_NONCONCURRENT` varchar(1) DEFAULT NULL,
  `REQUESTS_RECOVERY` varchar(1) DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`,`ENTRY_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_JOB_DETAILS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `JOB_NAME` varchar(190) NOT NULL,
  `JOB_GROUP` varchar(190) NOT NULL,
  `DESCRIPTION` varchar(250) DEFAULT NULL,
  `JOB_CLASS_NAME` varchar(250) NOT NULL,
  `IS_DURABLE` varchar(1) NOT NULL,
  `IS_NONCONCURRENT` varchar(1) NOT NULL,
  `IS_UPDATE_DATA` varchar(1) NOT NULL,
  `REQUESTS_RECOVERY` varchar(1) NOT NULL,
  `JOB_DATA` blob,
  PRIMARY KEY (`SCHED_NAME`,`JOB_NAME`,`JOB_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_LOCKS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `LOCK_NAME` varchar(40) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`,`LOCK_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_PAUSED_TRIGGER_GRPS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_SCHEDULER_STATE` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `INSTANCE_NAME` varchar(190) NOT NULL,
  `LAST_CHECKIN_TIME` bigint NOT NULL,
  `CHECKIN_INTERVAL` bigint NOT NULL,
  PRIMARY KEY (`SCHED_NAME`,`INSTANCE_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_SIMPLE_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `REPEAT_COUNT` bigint NOT NULL,
  `REPEAT_INTERVAL` bigint NOT NULL,
  `TIMES_TRIGGERED` bigint NOT NULL,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  CONSTRAINT `QRTZ_SIMPLE_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`) REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_SIMPROP_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `STR_PROP_1` varchar(512) DEFAULT NULL,
  `STR_PROP_2` varchar(512) DEFAULT NULL,
  `STR_PROP_3` varchar(512) DEFAULT NULL,
  `INT_PROP_1` int DEFAULT NULL,
  `INT_PROP_2` int DEFAULT NULL,
  `LONG_PROP_1` bigint DEFAULT NULL,
  `LONG_PROP_2` bigint DEFAULT NULL,
  `DEC_PROP_1` decimal(13,4) DEFAULT NULL,
  `DEC_PROP_2` decimal(13,4) DEFAULT NULL,
  `BOOL_PROP_1` varchar(1) DEFAULT NULL,
  `BOOL_PROP_2` varchar(1) DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  CONSTRAINT `QRTZ_SIMPROP_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`) REFERENCES `QRTZ_TRIGGERS` (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `QRTZ_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(190) NOT NULL,
  `TRIGGER_GROUP` varchar(190) NOT NULL,
  `JOB_NAME` varchar(190) NOT NULL,
  `JOB_GROUP` varchar(190) NOT NULL,
  `DESCRIPTION` varchar(250) DEFAULT NULL,
  `NEXT_FIRE_TIME` bigint DEFAULT NULL,
  `PREV_FIRE_TIME` bigint DEFAULT NULL,
  `PRIORITY` int DEFAULT NULL,
  `TRIGGER_STATE` varchar(16) NOT NULL,
  `TRIGGER_TYPE` varchar(8) NOT NULL,
  `START_TIME` bigint NOT NULL,
  `END_TIME` bigint DEFAULT NULL,
  `CALENDAR_NAME` varchar(190) DEFAULT NULL,
  `MISFIRE_INSTR` smallint DEFAULT NULL,
  `JOB_DATA` blob,
  PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
  KEY `SCHED_NAME` (`SCHED_NAME`,`JOB_NAME`,`JOB_GROUP`),
  CONSTRAINT `QRTZ_TRIGGERS_ibfk_1` FOREIGN KEY (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`) REFERENCES `QRTZ_JOB_DETAILS` (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `agent_execution_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `agentId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.agentId'))) STORED NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_index` (`agentId`),
  KEY `timestamp_index` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Agent Execution logs';
CREATE TABLE IF NOT EXISTS `ai_application_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Application entities';
CREATE TABLE IF NOT EXISTS `ai_governance_policy_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Governance Policy entities';
CREATE TABLE IF NOT EXISTS `api_collection_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_api_collection_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_api_collection_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `api_collection_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `api_endpoint_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_api_endpoint_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_api_endpoint_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `api_endpoint_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `api_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `name` (`name`),
  KEY `idx_api_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_api_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `api_service_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `apps_data_store` (
  `identifier` varchar(256) NOT NULL,
  `type` varchar(256) NOT NULL,
  `json` json NOT NULL,
  PRIMARY KEY (`identifier`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `apps_extension_time_series` (
  `appId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.appId'))) STORED NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `extension` varchar(255) NOT NULL,
  `appName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.appName'))) STORED NOT NULL,
  KEY `apps_extension_time_series_index` (`appId`),
  KEY `apps_extension_time_series_extension` (`extension`),
  KEY `apps_extension_time_series_timestamp` (`timestamp`),
  KEY `idx_apps_extension_composite` (`appId`,`extension`,`timestamp` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `apps_marketplace` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `index_apps_marketplace_deleted` (`nameHash`,`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `audit_log_event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `change_event_id` char(36) NOT NULL,
  `event_ts` bigint NOT NULL,
  `event_type` varchar(32) NOT NULL,
  `user_name` varchar(256) DEFAULT NULL,
  `actor_type` varchar(32) DEFAULT 'USER',
  `impersonated_by` varchar(256) DEFAULT NULL,
  `service_name` varchar(256) DEFAULT NULL,
  `entity_type` varchar(128) DEFAULT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `entity_fqn` varchar(768) DEFAULT NULL,
  `entity_fqn_hash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `event_json` longtext NOT NULL,
  `created_at` bigint DEFAULT ((unix_timestamp(now(3)) * 1000)),
  `search_text` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_audit_log_event_change_event_id` (`change_event_id`),
  KEY `idx_audit_log_event_ts` (`event_ts` DESC),
  KEY `idx_audit_log_event_user_ts` (`user_name`,`event_ts` DESC),
  KEY `idx_audit_log_event_entity_hash_ts` (`entity_fqn_hash`,`event_ts` DESC),
  KEY `idx_audit_log_actor_type_ts` (`actor_type`,`event_ts` DESC),
  KEY `idx_audit_log_service_name_ts` (`service_name`,`event_ts` DESC),
  KEY `idx_audit_log_created_at` (`created_at`),
  FULLTEXT KEY `idx_audit_log_search_text` (`search_text`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `automations_workflow` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) STORED,
  `workflowType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.workflowType'))) STORED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `automations_workflow_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `background_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jobType` varchar(256) NOT NULL,
  `methodName` varchar(256) NOT NULL,
  `jobArgs` json NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'PENDING',
  `createdBy` varchar(256) NOT NULL,
  `createdAt` bigint unsigned NOT NULL DEFAULT ((unix_timestamp(now(3)) * 1000)),
  `updatedAt` bigint unsigned NOT NULL DEFAULT ((unix_timestamp(now(3)) * 1000)),
  `runAt` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_createdAt` (`status`,`createdAt`),
  KEY `idx_createdBy` (`createdBy`),
  KEY `idx_status` (`status`),
  KEY `idx_jobType` (`jobType`),
  KEY `idx_updatedAt` (`updatedAt`),
  KEY `background_jobs_run_at_index` (`runAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `bot_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `bot_entity_name_index` (`name`),
  KEY `idx_bot_entity_deleted_name` (`deleted`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `change_event` (
  `eventType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.eventType'))) VIRTUAL NOT NULL,
  `entityType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `userName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.userName'))) VIRTUAL NOT NULL,
  `eventTime` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `offset` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`offset`),
  KEY `event_type_index` (`eventType`),
  KEY `entity_type_index` (`entityType`),
  KEY `idx_offset_event_time` (`offset`,`eventTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `change_event_consumers` (
  `id` varchar(36) NOT NULL,
  `extension` varchar(256) NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  UNIQUE KEY `id` (`id`,`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `chart_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `chart_entity_name_index` (`name`),
  KEY `idx_chart_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_chart_entity_deleted` (`deleted`),
  KEY `idx_chart_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `classification` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `classification_entity_name_index` (`name`),
  KEY `index_classification_deleted` (`nameHash`,`deleted`),
  KEY `idx_classification_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `consumers_dlq` (
  `id` varchar(36) NOT NULL,
  `extension` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `source` varchar(255) DEFAULT NULL,
  UNIQUE KEY `id` (`id`,`extension`),
  KEY `idx_consumers_dlq_source` (`source`),
  KEY `idx_consumers_dlq_timestamp_desc` (`timestamp` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `dashboard_data_model_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `dashboard_data_model_entity_name_index` (`name`),
  KEY `idx_dashboard_data_model_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_dashboard_data_model_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `dashboard_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `dashboard_entity_name_index` (`name`),
  KEY `idx_dashboard_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_dashboard_entity_deleted` (`deleted`),
  KEY `idx_dashboard_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `dashboard_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `dashboard_service_entity_name_index` (`name`),
  KEY `idx_dashboard_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_dashboard_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `data_contract_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_data_contract_entity_deleted_name_id` (`deleted`,`name`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `data_insight_chart` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `dataIndexType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.dataIndexType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `data_insight_name_index` (`name`),
  KEY `index_data_insight_chart_deleted` (`fqnHash`,`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `data_product_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_data_product_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `data_product_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `data_quality_data_time_series` (
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `extension` varchar(256) NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `incidentId` varchar(36) DEFAULT NULL,
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `data_quality_data_time_series_unique_hash_extension_ts` (`entityFQNHash`,`extension`,`timestamp`),
  KEY `data_quality_data_time_series_incidentId` (`incidentId`),
  KEY `data_quality_data_time_series_id_index` (`id`),
  KEY `data_quality_data_time_series_combined_id_ts` (`extension`,`timestamp`),
  KEY `idx_timestamp_desc` (`timestamp` DESC),
  KEY `idx_data_quality_data_ts_keyset` (`timestamp`,`entityFQNHash`),
  KEY `idx_entity_timestamp_desc` (`entityFQNHash`,`timestamp` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `database_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `database_entity_name_index` (`name`),
  KEY `idx_database_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_database_entity_deleted` (`deleted`),
  KEY `idx_database_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `database_schema_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `database_schema_entity_name_index` (`name`),
  KEY `idx_database_schema_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_database_schema_entity_deleted` (`deleted`),
  KEY `idx_database_schema_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `dbservice_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `dbservice_entity_name_index` (`name`),
  KEY `idx_dbservice_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_dbservice_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `di_chart_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fullyQualifiedName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.fullyQualifiedName'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  UNIQUE KEY `name` (`name`),
  KEY `name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `directory_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `directory_entity_fqn_hash` (`fqnHash`),
  KEY `directory_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `doc_store` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `entityType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `doc_store_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `domain_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_domain_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `domain_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `drive_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drive_service_entity_name_hash` (`nameHash`),
  KEY `drive_service_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `entity_deletion_lock` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `entityId` varchar(36) NOT NULL,
  `entityType` varchar(256) NOT NULL,
  `entityFqn` varchar(2048) NOT NULL,
  `lockType` varchar(50) NOT NULL,
  `lockedBy` varchar(256) NOT NULL,
  `lockedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expectedCompletion` timestamp NULL DEFAULT NULL,
  `deletionScope` varchar(50) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entity_deletion_lock_unique` (`entityId`,`entityType`),
  KEY `idx_deletion_lock_fqn` (`entityFqn`(255)),
  KEY `idx_deletion_lock_time` (`lockedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `entity_extension` (
  `id` varchar(36) NOT NULL,
  `extension` varchar(256) NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (cast(json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt')) as unsigned)) STORED,
  PRIMARY KEY (`id`,`extension`),
  KEY `extension_index` (`extension`),
  KEY `idx_entity_extension_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `entity_extension_time_series` (
  `extension` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `jsonSchema` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `json` json NOT NULL,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) STORED NOT NULL,
  UNIQUE KEY `entity_extension_time_series_constraint` (`entityFQNHash`,`extension`,`timestamp`),
  KEY `idx_entity_extension_ts_keyset` (`timestamp`,`entityFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `entity_relationship` (
  `fromId` varchar(36) NOT NULL,
  `toId` varchar(36) NOT NULL,
  `fromEntity` varchar(256) NOT NULL,
  `toEntity` varchar(256) NOT NULL,
  `relation` tinyint NOT NULL,
  `relationType` varchar(64) NOT NULL DEFAULT '',
  `jsonSchema` varchar(256) DEFAULT NULL,
  `json` json DEFAULT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`fromId`,`toId`,`relation`,`relationType`),
  KEY `from_index` (`fromId`,`relation`),
  KEY `to_index` (`toId`,`relation`),
  KEY `from_entity_type_index` (`fromId`,`fromEntity`),
  KEY `to_entity_type_index` (`toId`,`toEntity`),
  KEY `idx_entity_relationship_fromEntity_fromId_relation` (`fromEntity`,`fromId`,`relation`),
  KEY `idx_er_fromEntity_fromId_toEntity_relation` (`fromEntity`,`fromId`,`toEntity`,`relation`),
  KEY `idx_er_toEntity_toId_relation` (`toEntity`,`toId`,`relation`),
  KEY `idx_er_fromEntity_toEntity` (`fromEntity`,`toEntity`),
  KEY `idx_er_relation_fromEntity_toId` (`relation`,`fromEntity`,`toId`),
  KEY `idx_entity_rel_from_delete` (`fromId`,`fromEntity`,`toId`,`toEntity`,`relation`),
  KEY `idx_entity_rel_to_delete` (`toId`,`toEntity`,`fromId`,`fromEntity`,`relation`),
  KEY `idx_entity_rel_cascade` (`fromId`,`relation`,`toEntity`,`toId`),
  KEY `idx_entity_relationship_from_relation` (`fromId`,`relation`),
  KEY `idx_entity_relationship_to_relation` (`toId`,`relation`),
  KEY `idx_entity_relationship_from_type_relation` (`fromId`,`fromEntity`,`relation`),
  KEY `idx_entity_relationship_to_type_relation` (`toId`,`toEntity`,`relation`),
  KEY `idx_entity_relationship_from_deleted` (`fromId`,`fromEntity`,`relation`,`deleted`,`toId`,`toEntity`),
  KEY `idx_entity_relationship_to_deleted` (`toId`,`toEntity`,`relation`,`deleted`,`fromId`,`fromEntity`),
  KEY `idx_entity_relationship_from_typed` (`toId`,`toEntity`,`relation`,`fromEntity`,`deleted`,`fromId`),
  KEY `idx_entity_relationship_bidirectional` (`fromId`,`toId`,`relation`,`deleted`),
  KEY `idx_er_fromentity_toentity_relation_toid` (`fromEntity`,`toEntity`,`relation`,`toId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `entity_usage` (
  `id` varchar(36) NOT NULL,
  `entityType` varchar(20) NOT NULL,
  `usageDate` date DEFAULT NULL,
  `count1` int DEFAULT NULL,
  `count7` int DEFAULT NULL,
  `count30` int DEFAULT NULL,
  `percentile1` int DEFAULT NULL,
  `percentile7` int DEFAULT NULL,
  `percentile30` int DEFAULT NULL,
  UNIQUE KEY `usageDate` (`id`,`usageDate`),
  KEY `entity_usage_percentile_idx` (`usageDate`,`entityType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `event_subscription_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `event_subscription_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `field_relationship` (
  `fromFQN` varchar(2096) NOT NULL,
  `toFQN` varchar(2096) NOT NULL,
  `fromType` varchar(256) NOT NULL,
  `toType` varchar(256) NOT NULL,
  `relation` tinyint NOT NULL,
  `jsonSchema` varchar(256) DEFAULT NULL,
  `json` json DEFAULT NULL,
  `fromFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `toFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`fromFQNHash`,`toFQNHash`,`relation`),
  KEY `from_fqnhash_index` (`fromFQNHash`,`relation`),
  KEY `to_fqnhash_index` (`toFQNHash`,`relation`),
  KEY `idx_field_relationship_from` (`fromType`,`fromFQNHash`,`toType`,`relation`),
  KEY `idx_field_relationship_to` (`fromType`,`toFQNHash`,`toType`,`relation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `file_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fileType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.fileType'))) VIRTUAL,
  `directoryFqn` varchar(768) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.directory.fullyQualifiedName'))) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_entity_fqn_hash` (`fqnHash`),
  KEY `idx_file_filetype` (`fileType`),
  KEY `idx_file_directory_fqn` (`directoryFqn`),
  KEY `file_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `glossary_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `glossary_entity_name_index` (`name`),
  KEY `idx_glossary_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_glossary_entity_deleted` (`deleted`),
  KEY `idx_glossary_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `glossary_term_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(756) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `displayName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.displayName'))) STORED,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `entityStatus` varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityStatus'))) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `idx_glossary_term_displayName` (`displayName`),
  KEY `idx_glossary_term_entity_status` (`entityStatus`),
  KEY `glossary_term_entity_name_index` (`name`),
  KEY `idx_glossary_term_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_glossary_term_entity_deleted` (`deleted`),
  KEY `idx_glossary_term_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `index_mapping_versions` (
  `entityType` varchar(256) NOT NULL,
  `mappingHash` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `mappingJson` json NOT NULL,
  `version` varchar(36) NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  `updatedBy` varchar(256) NOT NULL,
  PRIMARY KEY (`entityType`),
  KEY `idx_version` (`version`),
  KEY `idx_updatedAt` (`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `ingestion_pipeline_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `timestamp` bigint DEFAULT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `appType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.sourceConfig.config.appConfig.type'))) STORED,
  `pipelineType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.pipelineType'))) STORED,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `ingestion_pipeline_entity_name_index` (`name`),
  KEY `idx_ingestion_pipeline_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_ingestion_pipeline_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `installed_apps` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `index_installed_apps_deleted` (`nameHash`,`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `intake_form_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `entityType` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (if((json_extract(`json`,_utf8mb4'$.deleted') = true),1,0)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  UNIQUE KEY `intake_form_entity_type_unique` (`entityType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `kpi_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `kpi_entity_name_index` (`name`),
  KEY `idx_kpi_entity_deleted_name` (`deleted`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `learning_resource_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.fullyQualifiedName'))) VIRTUAL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (if((json_extract(`json`,_utf8mb4'$.deleted') = true),1,0)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `llm_model_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='LLM Model entities';
CREATE TABLE IF NOT EXISTS `llm_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `name_index` (`name`),
  KEY `service_type_index` (`serviceType`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='LLM Service entities';
CREATE TABLE IF NOT EXISTS `mcp_execution_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `serverId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serverId'))) STORED NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  KEY `server_index` (`serverId`),
  KEY `timestamp_index` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Execution logs';
CREATE TABLE IF NOT EXISTS `mcp_pending_auth_requests` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `auth_request_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_challenge` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_challenge_method` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'S256',
  `redirect_uri` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mcp_state` text COLLATE utf8mb4_unicode_ci,
  `scopes` json DEFAULT NULL,
  `pac4j_state` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pac4j_nonce` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pac4j_code_verifier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_request_id` (`auth_request_id`),
  KEY `idx_mcp_pending_auth_request_id` (`auth_request_id`),
  KEY `idx_mcp_pending_auth_expires` (`expires_at`),
  KEY `idx_mcp_pending_auth_pac4j_state` (`pac4j_state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `mcp_server_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Server entities';
CREATE TABLE IF NOT EXISTS `mcp_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `name_index` (`name`),
  KEY `service_type_index` (`serviceType`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Service entities';
CREATE TABLE IF NOT EXISTS `messaging_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `messaing_service_entity_name_index` (`name`),
  KEY `idx_messaging_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_messaging_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `metadata_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `metadata_service_entity_name_index` (`name`),
  KEY `idx_metadata_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_metadata_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `metric_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `customUnitOfMeasurement` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.customUnitOfMeasurement'))) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `metric_entity_name_index` (`name`),
  KEY `idx_metric_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_metric_custom_unit` (`customUnitOfMeasurement`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `ml_model_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `ml_model_entity_name_index` (`name`),
  KEY `idx_ml_model_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_ml_model_entity_deleted` (`deleted`),
  KEY `idx_ml_model_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `mlmodel_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `mlmodel_service_entity_name_index` (`name`),
  KEY `idx_mlmodel_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_mlmodel_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `notification_template_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `provider` varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.provider'))) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `idx_notification_template_name` (`name`),
  KEY `idx_notification_template_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `oauth_access_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_token_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scopes` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `expires_at` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_oauth_access_tokens_hash` (`token_hash`),
  KEY `idx_oauth_access_tokens_client_id` (`client_id`),
  KEY `idx_oauth_access_tokens_expires_at` (`expires_at`),
  CONSTRAINT `oauth_access_tokens_fk_client` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `oauth_access_tokens_expires_check` CHECK ((`expires_at` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `oauth_authorization_codes` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `code` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_challenge` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_challenge_method` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `redirect_uri` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `scopes` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `expires_at` bigint NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_oauth_authz_codes_code` (`code`),
  KEY `idx_oauth_authz_codes_client_id` (`client_id`),
  KEY `idx_oauth_authz_codes_expires_at` (`expires_at`),
  CONSTRAINT `oauth_authorization_codes_fk_client` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `oauth_authorization_codes_challenge_method_check` CHECK (((`code_challenge_method` is null) or (`code_challenge_method` = _utf8mb4'S256'))),
  CONSTRAINT `oauth_authorization_codes_expires_check` CHECK ((`expires_at` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `oauth_clients` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `client_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_secret_encrypted` text COLLATE utf8mb4_unicode_ci,
  `client_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `redirect_uris` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `grant_types` json NOT NULL DEFAULT (_utf8mb4'["authorization_code", "refresh_token"]'),
  `token_endpoint_auth_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'client_secret_post',
  `scopes` json NOT NULL DEFAULT (_utf8mb4'["read", "write"]'),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_id` (`client_id`),
  KEY `idx_oauth_clients_client_id` (`client_id`),
  CONSTRAINT `oauth_clients_client_id_check` CHECK ((char_length(`client_id`) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `oauth_refresh_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scopes` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `expires_at` bigint NOT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_oauth_refresh_tokens_hash` (`token_hash`),
  KEY `idx_oauth_refresh_tokens_client_id` (`client_id`),
  KEY `idx_oauth_refresh_tokens_revoked` (`revoked`),
  KEY `idx_oauth_refresh_tokens_expires_at` (`expires_at`),
  CONSTRAINT `oauth_refresh_tokens_fk_client` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `oauth_refresh_tokens_expires_check` CHECK ((`expires_at` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `openmetadata_settings` (
  `id` mediumint NOT NULL AUTO_INCREMENT,
  `configType` varchar(36) NOT NULL,
  `json` json NOT NULL,
  PRIMARY KEY (`id`,`configType`),
  UNIQUE KEY `configType` (`configType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `persona_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `persona_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `pipeline_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `pipeline_entity_name_index` (`name`),
  KEY `idx_pipeline_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_pipeline_entity_deleted` (`deleted`),
  KEY `idx_pipeline_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `pipeline_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `pipeline_service_entity_name_index` (`name`),
  KEY `idx_pipeline_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_pipeline_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `policy_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `policy_entity_name_index` (`name`),
  KEY `idx_policy_entity_deleted_name_id` (`deleted`,`name`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `profiler_data_time_series` (
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `extension` varchar(256) NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `operation` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.profileData.operation'))) VIRTUAL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  UNIQUE KEY `profiler_data_time_series_unique_hash_extension_ts` (`entityFQNHash`,`extension`,`operation`,`timestamp`),
  KEY `profiler_data_time_series_combined_id_ts` (`extension`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `prompt_template_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `deleted_index` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt Template entities';
CREATE TABLE IF NOT EXISTS `query_cost_time_series` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `cost` float GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.cost'))) VIRTUAL NOT NULL,
  `count` int GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.count'))) VIRTUAL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `query_cost_unique_constraint` (`timestamp`,`entityFQNHash`),
  KEY `id` (`id`),
  KEY `id_2` (`id`,`timestamp`),
  KEY `idx_query_cost_ts_keyset` (`timestamp`,`entityFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `query_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) DEFAULT NULL,
  `checksum` varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.checksum'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_query_checksum` (`checksum`),
  UNIQUE KEY `nameHash` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `query_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `rdf_index_job` (
  `id` varchar(36) NOT NULL,
  `status` varchar(32) NOT NULL,
  `jobConfiguration` json NOT NULL,
  `totalRecords` bigint NOT NULL DEFAULT '0',
  `processedRecords` bigint NOT NULL DEFAULT '0',
  `successRecords` bigint NOT NULL DEFAULT '0',
  `failedRecords` bigint NOT NULL DEFAULT '0',
  `stats` json DEFAULT NULL,
  `createdBy` varchar(256) NOT NULL,
  `createdAt` bigint NOT NULL,
  `startedAt` bigint DEFAULT NULL,
  `completedAt` bigint DEFAULT NULL,
  `updatedAt` bigint NOT NULL,
  `errorMessage` text,
  PRIMARY KEY (`id`),
  KEY `idx_rdf_index_job_status` (`status`),
  KEY `idx_rdf_index_job_created` (`createdAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `rdf_index_partition` (
  `id` varchar(36) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `entityType` varchar(128) NOT NULL,
  `partitionIndex` int NOT NULL,
  `rangeStart` bigint NOT NULL,
  `rangeEnd` bigint NOT NULL,
  `estimatedCount` bigint NOT NULL,
  `workUnits` bigint NOT NULL,
  `priority` int NOT NULL DEFAULT '50',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `processingCursor` bigint NOT NULL DEFAULT '0',
  `processedCount` bigint NOT NULL DEFAULT '0',
  `successCount` bigint NOT NULL DEFAULT '0',
  `failedCount` bigint NOT NULL DEFAULT '0',
  `assignedServer` varchar(255) DEFAULT NULL,
  `claimedAt` bigint DEFAULT NULL,
  `startedAt` bigint DEFAULT NULL,
  `completedAt` bigint DEFAULT NULL,
  `lastUpdateAt` bigint DEFAULT NULL,
  `lastError` text,
  `retryCount` int NOT NULL DEFAULT '0',
  `claimableAt` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rdf_partition_job_entity_idx` (`jobId`,`entityType`,`partitionIndex`),
  KEY `idx_rdf_partition_job` (`jobId`),
  KEY `idx_rdf_partition_status_priority` (`status`,`priority` DESC),
  KEY `idx_rdf_partition_claimable` (`jobId`,`status`,`claimableAt`),
  KEY `idx_rdf_partition_assigned_server` (`jobId`,`assignedServer`),
  CONSTRAINT `fk_rdf_partition_job` FOREIGN KEY (`jobId`) REFERENCES `rdf_index_job` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `rdf_index_server_stats` (
  `id` varchar(36) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `serverId` varchar(256) NOT NULL,
  `entityType` varchar(128) NOT NULL,
  `processedRecords` bigint DEFAULT '0',
  `successRecords` bigint DEFAULT '0',
  `failedRecords` bigint DEFAULT '0',
  `partitionsCompleted` int DEFAULT '0',
  `partitionsFailed` int DEFAULT '0',
  `lastUpdatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_rdf_index_server_stats_job_server_entity` (`jobId`,`serverId`,`entityType`),
  KEY `idx_rdf_index_server_stats_job_id` (`jobId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `rdf_reindex_lock` (
  `lockKey` varchar(64) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `serverId` varchar(255) NOT NULL,
  `acquiredAt` bigint NOT NULL,
  `lastHeartbeat` bigint NOT NULL,
  `expiresAt` bigint NOT NULL,
  PRIMARY KEY (`lockKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `recognizer_feedback_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `entityLink` varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityLink'))) VIRTUAL NOT NULL,
  `tagFQN` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.tagFQN'))) VIRTUAL NOT NULL,
  `feedbackType` varchar(50) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.feedbackType'))) VIRTUAL NOT NULL,
  `status` varchar(20) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) VIRTUAL,
  `createdBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdBy'))) VIRTUAL NOT NULL,
  `createdAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdAt'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_entity` (`entityLink`),
  KEY `idx_feedback_tag` (`tagFQN`),
  KEY `idx_feedback_status` (`status`),
  KEY `idx_feedback_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `report_data_time_series` (
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `extension` varchar(256) NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `date` date GENERATED ALWAYS AS (from_unixtime((json_unquote(json_extract(`json`,_utf8mb4'$.timestamp')) DIV 1000))) VIRTUAL NOT NULL,
  KEY `report_data_time_series_point_ts` (`timestamp`),
  KEY `report_data_time_series_date` (`date`),
  KEY `idx_report_data_ts_keyset` (`timestamp`,`entityFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `report_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `report_entity_name_index` (`name`),
  KEY `idx_report_entity_deleted_name_id` (`deleted`,`name`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `role_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `role_entity_name_index` (`name`),
  KEY `idx_role_entity_deleted_name` (`deleted`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_search_index_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_search_index_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `search_index_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_failures` (
  `id` varchar(36) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `serverId` varchar(256) NOT NULL,
  `entityType` varchar(256) NOT NULL,
  `entityId` varchar(36) DEFAULT NULL,
  `entityFqn` varchar(1024) DEFAULT NULL,
  `failureStage` varchar(32) NOT NULL,
  `errorMessage` longtext,
  `stackTrace` longtext,
  `timestamp` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_search_index_failures_job_id` (`jobId`),
  KEY `idx_search_index_failures_server_id` (`serverId`),
  KEY `idx_search_index_failures_entity_type` (`entityType`),
  KEY `idx_search_index_failures_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_job` (
  `id` varchar(36) NOT NULL,
  `status` varchar(32) NOT NULL,
  `jobConfiguration` json NOT NULL,
  `targetIndexPrefix` varchar(255) DEFAULT NULL,
  `stagedIndexMapping` json DEFAULT NULL,
  `totalRecords` bigint NOT NULL DEFAULT '0',
  `processedRecords` bigint NOT NULL DEFAULT '0',
  `successRecords` bigint NOT NULL DEFAULT '0',
  `failedRecords` bigint NOT NULL DEFAULT '0',
  `stats` json DEFAULT NULL,
  `createdBy` varchar(256) NOT NULL,
  `createdAt` bigint NOT NULL,
  `startedAt` bigint DEFAULT NULL,
  `completedAt` bigint DEFAULT NULL,
  `updatedAt` bigint NOT NULL,
  `errorMessage` text,
  `registrationDeadline` bigint DEFAULT NULL,
  `registeredServerCount` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_search_index_job_status` (`status`),
  KEY `idx_search_index_job_created` (`createdAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_partition` (
  `id` varchar(36) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `entityType` varchar(128) NOT NULL,
  `partitionIndex` int NOT NULL,
  `rangeStart` bigint NOT NULL,
  `rangeEnd` bigint NOT NULL,
  `estimatedCount` bigint NOT NULL,
  `workUnits` bigint NOT NULL,
  `priority` int NOT NULL DEFAULT '50',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `processingCursor` bigint NOT NULL DEFAULT '0',
  `processedCount` bigint NOT NULL DEFAULT '0',
  `successCount` bigint NOT NULL DEFAULT '0',
  `failedCount` bigint NOT NULL DEFAULT '0',
  `assignedServer` varchar(255) DEFAULT NULL,
  `claimedAt` bigint DEFAULT NULL,
  `startedAt` bigint DEFAULT NULL,
  `completedAt` bigint DEFAULT NULL,
  `lastUpdateAt` bigint DEFAULT NULL,
  `lastError` text,
  `retryCount` int NOT NULL DEFAULT '0',
  `claimableAt` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_partition_job_entity_idx` (`jobId`,`entityType`,`partitionIndex`),
  KEY `idx_partition_job` (`jobId`),
  KEY `idx_partition_status_priority` (`status`,`priority` DESC),
  KEY `idx_partition_claimed` (`claimedAt`),
  KEY `idx_partition_assigned_server` (`jobId`,`assignedServer`),
  KEY `idx_partition_claimable` (`jobId`,`status`,`claimableAt`),
  CONSTRAINT `fk_partition_job` FOREIGN KEY (`jobId`) REFERENCES `search_index_job` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_retry_queue` (
  `entityId` varchar(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  `entityFqn` varchar(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  `failureReason` longtext,
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `entityType` varchar(256) NOT NULL DEFAULT '',
  `retryCount` int NOT NULL DEFAULT '0',
  `claimedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`entityId`,`entityFqn`),
  KEY `idx_search_index_retry_queue_status` (`status`),
  KEY `idx_search_index_retry_queue_claimed` (`claimedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_index_server_stats` (
  `id` varchar(36) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `serverId` varchar(256) NOT NULL,
  `readerSuccess` bigint DEFAULT '0',
  `readerFailed` bigint DEFAULT '0',
  `readerWarnings` bigint DEFAULT '0',
  `sinkSuccess` bigint DEFAULT '0',
  `sinkFailed` bigint DEFAULT '0',
  `partitionsCompleted` int DEFAULT '0',
  `partitionsFailed` int DEFAULT '0',
  `lastUpdatedAt` bigint NOT NULL,
  `processSuccess` bigint DEFAULT '0',
  `processFailed` bigint DEFAULT '0',
  `vectorSuccess` bigint DEFAULT '0',
  `vectorFailed` bigint DEFAULT '0',
  `vectorWarnings` bigint DEFAULT '0',
  `entityType` varchar(128) NOT NULL DEFAULT 'unknown',
  `readerTimeMs` bigint NOT NULL DEFAULT '0',
  `processTimeMs` bigint NOT NULL DEFAULT '0',
  `sinkTimeMs` bigint NOT NULL DEFAULT '0',
  `vectorTimeMs` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_search_index_server_stats_job_server_entity` (`jobId`,`serverId`,`entityType`),
  KEY `idx_search_index_server_stats_job_id` (`jobId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_reindex_lock` (
  `lockKey` varchar(64) NOT NULL,
  `jobId` varchar(36) NOT NULL,
  `serverId` varchar(255) NOT NULL,
  `acquiredAt` bigint NOT NULL,
  `lastHeartbeat` bigint NOT NULL,
  `expiresAt` bigint NOT NULL,
  PRIMARY KEY (`lockKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `search_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `name` (`name`),
  KEY `idx_search_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_search_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `search_service_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `security_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `spreadsheet_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `directoryFqn` varchar(768) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.directory.fullyQualifiedName'))) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `spreadsheet_entity_fqn_hash` (`fqnHash`),
  KEY `idx_spreadsheet_directory_fqn` (`directoryFqn`),
  KEY `spreadsheet_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `storage_container_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `storage_container_entity_name_index` (`name`),
  KEY `idx_storage_container_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_storage_container_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `storage_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `storage_service_entity_name_index` (`name`),
  KEY `idx_storage_service_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_storage_service_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `stored_procedure_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `databaseSchemaHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (substring_index(`fqnHash`,_utf8mb4'.',3)) STORED,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`),
  KEY `idx_stored_procedure_schema_listing` (`deleted`,`databaseSchemaHash`,`name`,`id`),
  KEY `idx_stored_procedure_entity_updated_at_id` (`updatedAt` DESC,`id` DESC),
  KEY `stored_procedure_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `successful_sent_change_events` (
  `change_event_id` varchar(36) NOT NULL,
  `event_subscription_id` varchar(36) NOT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned NOT NULL,
  PRIMARY KEY (`change_event_id`,`event_subscription_id`),
  KEY `idx_event_subscription_id` (`event_subscription_id`),
  KEY `idx_successful_events_timestamp_desc` (`timestamp` DESC),
  KEY `idx_successful_events_subscription_timestamp` (`event_subscription_id`,`timestamp` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `suggestions` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `entityLink` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityLink'))) VIRTUAL NOT NULL,
  `suggestionType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_unquote(json_extract(`json`,_utf8mb4'$.type')))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `status` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  KEY `index_suggestions_type` (`suggestionType`),
  KEY `index_suggestions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `table_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `databaseSchemaHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (substring_index(`fqnHash`,_utf8mb4'.',3)) STORED,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `table_entity_name_index` (`name`),
  KEY `index_table_entity_deleted` (`fqnHash`,`deleted`),
  KEY `idx_table_entity_deleted_fqnHash` (`deleted`,`fqnHash`),
  KEY `idx_table_entity_name_id` (`name`,`id`),
  KEY `idx_table_entity_deleted` (`deleted`),
  KEY `idx_table_entity_schema_listing` (`deleted`,`databaseSchemaHash`,`name`,`id`),
  KEY `idx_table_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `tag` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `classificationHash` varchar(255) GENERATED ALWAYS AS (substring_index(`fqnHash`,_utf8mb4'.',1)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `tag_entity_name_index` (`name`),
  KEY `index_tag_deleted` (`fqnHash`,`deleted`),
  KEY `idx_tag_classification_hash_deleted` (`classificationHash`,`deleted`),
  KEY `idx_tag_classification_deleted` (`classificationHash`,`deleted`),
  KEY `idx_tag_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `tag_usage` (
  `source` tinyint NOT NULL,
  `tagFQN` varchar(512) NOT NULL,
  `labelType` tinyint NOT NULL,
  `state` tinyint NOT NULL,
  `tagFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `targetFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `reason` text,
  `targetfqnhash_lower` varchar(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((convert(lower(`targetFQNHash`) using utf8mb4) collate utf8mb4_unicode_ci)) STORED,
  `tagfqn_lower` varchar(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((convert(lower(`tagFQN`) using utf8mb4) collate utf8mb4_unicode_ci)) STORED,
  `appliedAt` timestamp(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `appliedBy` varchar(64) DEFAULT 'admin',
  `metadata` json DEFAULT NULL,
  UNIQUE KEY `tag_usage_key` (`source`,`tagFQNHash`,`targetFQNHash`),
  KEY `idx_tag_usage_target_fqn_hash` (`targetFQNHash`),
  KEY `idx_tag_usage_tag_fqn_hash` (`tagFQNHash`),
  KEY `idx_tag_usage_source_target` (`source`,`targetFQNHash`),
  KEY `idx_tag_usage_target_source` (`targetFQNHash`,`source`,`tagFQN`),
  KEY `idx_targetfqnhash_lower` (`targetfqnhash_lower`(255)),
  KEY `idx_tagfqn_lower` (`tagfqn_lower`(255)),
  KEY `idx_tag_usage_target_prefix_composite` (`source`,`targetfqnhash_lower`(255),`state`,`tagFQN`(255),`labelType`),
  KEY `idx_tag_usage_target_exact_composite` (`source`,`targetFQNHash`(255),`state`,`tagFQN`(255),`labelType`),
  KEY `idx_tag_usage_tagfqn_prefix_composite` (`source`,`tagfqn_lower`(255),`state`,`targetFQNHash`(255),`labelType`),
  KEY `idx_tag_usage_join_composite` (`tagFQNHash`(255),`source`,`state`,`targetFQNHash`(255),`tagFQN`(255),`labelType`),
  FULLTEXT KEY `ft_tag_usage_targetfqn` (`targetFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `task_sequence` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `team_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `teamType` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.teamType'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `team_entity_name_index` (`name`),
  KEY `idx_team_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_team_entity_deleted` (`deleted`),
  KEY `idx_team_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_case` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `entityFQN` varchar(1024) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityFQN'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `name` varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `entityLink` varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityLink'))) STORED NOT NULL,
  `status` varchar(56) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.testCaseStatus'))) STORED,
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `test_case_name_index` (`name`),
  KEY `index_test_case_deleted` (`fqnHash`,`deleted`),
  KEY `idx_test_case_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_case_dimension_results_time_series` (
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `extension` varchar(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `testCaseResultId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.testCaseResultId'))) STORED NOT NULL,
  `dimensionKey` varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.dimensionKey'))) STORED NOT NULL,
  `dimensionName` varchar(256) GENERATED ALWAYS AS (substring_index(json_unquote(json_extract(`json`,_utf8mb4'$.dimensionKey')),_utf8mb4'=',1)) STORED,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) STORED NOT NULL,
  `testCaseStatus` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.testCaseStatus'))) STORED,
  UNIQUE KEY `test_case_dimension_results_unique_constraint` (`entityFQNHash`,`dimensionKey`,`timestamp`),
  KEY `test_case_dimension_results_main` (`entityFQNHash`,`timestamp`,`dimensionKey`),
  KEY `test_case_dimension_results_dimension_name` (`entityFQNHash`,`dimensionName`,`timestamp`),
  KEY `test_case_dimension_results_result_id` (`testCaseResultId`),
  KEY `test_case_dimension_results_ts` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_case_resolution_status_time_series` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `stateId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.stateId'))) VIRTUAL NOT NULL,
  `assignee` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.testCaseResolutionStatusDetails.assignee.name'))) VIRTUAL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `testCaseResolutionStatusType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.testCaseResolutionStatusType'))) VIRTUAL NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `test_case_resolution_status_unique_constraint` (`id`,`timestamp`,`entityFQNHash`),
  KEY `id` (`id`),
  KEY `testCaseResolutionStatusType` (`testCaseResolutionStatusType`),
  KEY `id_2` (`id`,`testCaseResolutionStatusType`),
  KEY `idx_test_case_resolution_status_ts_keyset` (`timestamp`,`entityFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_connection_definition` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fullyQualifiedName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.fullyQualifiedName'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `test_connection_definition_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_definition` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `entityType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `supported_data_types` json GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.supportedDataTypes')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `enabled` tinyint(1) GENERATED ALWAYS AS (coalesce(cast(json_extract(`json`,_utf8mb4'$.enabled') as unsigned),1)) VIRTUAL,
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `test_definition_name_index` (`name`),
  KEY `idx_test_definition_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `test_suite` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `nameHash` (`fqnHash`),
  KEY `test_suite_name_index` (`name`),
  KEY `index_test_suite_deleted` (`fqnHash`,`deleted`),
  KEY `idx_test_suite_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `thread_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `entityLink` varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.about'))) VIRTUAL NOT NULL,
  `assignedTo` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.addressedTo'))) VIRTUAL,
  `json` json NOT NULL,
  `createdAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.threadTs'))) STORED NOT NULL,
  `createdBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdBy'))) STORED NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `resolved` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.resolved')) VIRTUAL,
  `type` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.type'))) VIRTUAL,
  `taskId` int unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.task.id'))) VIRTUAL,
  `taskStatus` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.task.status'))) VIRTUAL,
  `taskAssignees` json GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.task.assignees')) VIRTUAL,
  `announcementStart` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.announcement.startTime'))) VIRTUAL,
  `announcementEnd` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.announcement.endTime'))) VIRTUAL,
  `hash_id` varchar(32) GENERATED ALWAYS AS (md5(`id`)) STORED,
  `testCaseResolutionStatusId` varchar(255) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.task.testCaseResolutionStatusId'))) STORED,
  `taskAssigneesIds` text GENERATED ALWAYS AS (replace(replace(json_unquote(json_extract(`taskAssignees`,_utf8mb4'$[*].id')),_utf8mb4'[',_utf8mb4''),_utf8mb4']',_utf8mb4'')) STORED,
  `entityId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityRef.id'))) VIRTUAL,
  `entityType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityRef.type'))) VIRTUAL,
  `domains` text GENERATED ALWAYS AS ((case when ((json_extract(`json`,_utf8mb4'$.domains') is null) or (json_length(json_extract(`json`,_utf8mb4'$.domains')) = 0)) then NULL else json_unquote(json_extract(`json`,_utf8mb4'$.domains')) end)) STORED,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_id_constraint` (`taskId`),
  KEY `created_by_index` (`createdBy`),
  KEY `created_at_index` (`createdAt`),
  KEY `idx_thread_entity_hash_id` (`hash_id`),
  KEY `idx_testCaseResolutionStatusId` (`testCaseResolutionStatusId`),
  KEY `idx_thread_entity_entityId_createdAt` (`createdAt`),
  KEY `task_status_index` (`taskStatus`),
  KEY `thread_type_resolved_updatedAt_index` (`type`,`resolved`,`updatedAt`),
  KEY `idx_type_task_status` (`type`,`taskStatus`),
  KEY `idx_thread_entity_id_type_status` (`id`,`type`,`taskStatus`),
  KEY `idx_thread_type_resolved_createdAt` (`type`,`resolved`,`createdAt` DESC),
  KEY `idx_thread_entity_entityId` (`entityId`),
  KEY `idx_thread_entity_type_announcementDates` (`type`,`announcementStart`,`announcementEnd`),
  KEY `idx_thread_entity_createdBy_type` (`createdBy`,`type`),
  KEY `idx_thread_entity_type_taskStatus_createdAt` (`type`,`taskStatus`,`createdAt` DESC),
  FULLTEXT KEY `taskAssigneesIds_index` (`taskAssigneesIds`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `topic_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `topic_entity_name_index` (`name`),
  KEY `idx_topic_entity_deleted_name_id` (`deleted`,`name`,`id`),
  KEY `idx_topic_entity_deleted` (`deleted`),
  KEY `idx_topic_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `type_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `category` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.category'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `type_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `user_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `email` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.email'))) VIRTUAL NOT NULL,
  `deactivated` varchar(8) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.deactivated'))) VIRTUAL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `isBot` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.isBot')) VIRTUAL NOT NULL,
  `lastLoginTime` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.lastLoginTime'))) VIRTUAL,
  `lastActivityTime` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.lastActivityTime'))) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `user_entity_name_index` (`name`),
  KEY `idx_isBot` (`isBot`),
  KEY `idx_user_entity_last_login_time` (`lastLoginTime`),
  KEY `idx_user_entity_last_activity_time` (`lastActivityTime`),
  KEY `idx_user_entity_last_login_deleted` (`lastLoginTime`,`deleted`),
  KEY `idx_user_entity_last_activity_deleted` (`lastActivityTime`,`deleted`),
  KEY `idx_user_entity_deleted_name` (`deleted`,`name`),
  KEY `idx_user_entity_deleted` (`deleted`),
  KEY `idx_user_entity_updated_at_id` (`updatedAt` DESC,`id` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `user_tokens` (
  `token` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.token'))) STORED NOT NULL,
  `userId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.userId'))) STORED NOT NULL,
  `tokenType` varchar(50) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.tokenType'))) STORED NOT NULL,
  `json` json NOT NULL,
  `expiryDate` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.expiryDate'))) VIRTUAL,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `web_analytic_event` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `eventType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.eventType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name_index` (`name`),
  KEY `web_analytic_event_name_index` (`name`),
  KEY `index_web_analytic_event_deleted` (`fqnHash`,`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `workflow_definition_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL NOT NULL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `workflow_instance_state_time_series` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `workflowInstanceId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.workflowInstanceId'))) STORED NOT NULL,
  `workflowInstanceExecutionId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.workflowInstanceExecutionId'))) STORED NOT NULL,
  `workflowDefinitionId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.workflowDefinitionId'))) STORED NOT NULL,
  `stage` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.stage.name'))) STORED NOT NULL,
  `stageStartedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.stage.startedAt'))) STORED NOT NULL,
  `stageEndedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.stage.endedAt'))) STORED,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) STORED NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(20) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) VIRTUAL NOT NULL,
  `exceptionStacktrace` text GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.exception'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_instance_state_time_series_unique_constraint` (`id`,`entityFQNHash`),
  KEY `workflowDefinitionId` (`workflowDefinitionId`),
  KEY `workflowInstanceId` (`workflowInstanceId`),
  KEY `workflow_instance_state_time_series_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `workflow_instance_time_series` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `workflowDefinitionId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.workflowDefinitionId'))) STORED NOT NULL,
  `json` json NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) STORED NOT NULL,
  `startedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.startedAt'))) STORED NOT NULL,
  `endedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.endedAt'))) STORED,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(20) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) VIRTUAL NOT NULL,
  `exceptionStacktrace` text GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.exception'))) VIRTUAL,
  `entityLink` text GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.variables.global_relatedEntity'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_instance_time_series_unique_constraint` (`id`,`entityFQNHash`),
  KEY `workflowDefinitionId` (`workflowDefinitionId`),
  KEY `workflow_instance_time_series_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `worksheet_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `spreadsheetFqn` varchar(768) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.spreadsheet.fullyQualifiedName'))) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `impersonatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.impersonatedBy'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worksheet_entity_fqn_hash` (`fqnHash`),
  KEY `idx_worksheet_spreadsheet_fqn` (`spreadsheetFqn`),
  KEY `worksheet_entity_name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM task_sequence);
