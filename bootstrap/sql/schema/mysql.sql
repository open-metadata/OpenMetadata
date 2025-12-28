--
-- Table structure for table `automations_workflow`
--

DROP TABLE IF EXISTS `automations_workflow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automations_workflow` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `workflowType` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bot_entity`
--

DROP TABLE IF EXISTS `bot_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bot_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `change_event`
--

DROP TABLE IF EXISTS `change_event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_event` (
  `eventType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.eventType'))) VIRTUAL NOT NULL,
  `entityType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `userName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.userName'))) VIRTUAL NOT NULL,
  `eventTime` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  KEY `event_type_index` (`eventType`),
  KEY `entity_type_index` (`entityType`),
  KEY `event_time_index` (`eventTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chart_entity`
--

DROP TABLE IF EXISTS `chart_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chart_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `classification`
--

DROP TABLE IF EXISTS `classification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classification` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dashboard_data_model_entity`
--

DROP TABLE IF EXISTS `dashboard_data_model_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboard_data_model_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dashboard_entity`
--

DROP TABLE IF EXISTS `dashboard_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboard_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dashboard_service_entity`
--

DROP TABLE IF EXISTS `dashboard_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dashboard_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `data_insight_chart`
--

DROP TABLE IF EXISTS `data_insight_chart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_insight_chart` (
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
  KEY `name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `data_product_entity`
--

DROP TABLE IF EXISTS `data_product_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_product_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `DATABASE_CHANGE_LOG`
--

DROP TABLE IF EXISTS `DATABASE_CHANGE_LOG`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DATABASE_CHANGE_LOG` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `type` varchar(20) NOT NULL,
  `script` varchar(1000) NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `DATABASE_CHANGE_LOG_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `database_entity`
--

DROP TABLE IF EXISTS `database_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `database_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `database_schema_entity`
--

DROP TABLE IF EXISTS `database_schema_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `database_schema_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dbservice_entity`
--

DROP TABLE IF EXISTS `dbservice_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dbservice_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `domain_entity`
--

DROP TABLE IF EXISTS `domain_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `domain_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_extension`
--

DROP TABLE IF EXISTS `entity_extension`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_extension` (
  `id` varchar(36) NOT NULL,
  `extension` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `jsonSchema` varchar(256) NOT NULL,
  `json` json NOT NULL,
  PRIMARY KEY (`id`,`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_extension_time_series`
--

DROP TABLE IF EXISTS `entity_extension_time_series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_extension_time_series` (
  `extension` varchar(100) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `jsonSchema` varchar(50) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `json` json NOT NULL,
  `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.timestamp'))) VIRTUAL NOT NULL,
  `entityFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `entity_extension_time_series_constraint` (`entityFQNHash`,`extension`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_relationship`
--

DROP TABLE IF EXISTS `entity_relationship`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_relationship` (
  `fromId` varchar(36) NOT NULL,
  `toId` varchar(36) NOT NULL,
  `fromEntity` varchar(256) NOT NULL,
  `toEntity` varchar(256) NOT NULL,
  `relation` tinyint NOT NULL,
  `jsonSchema` varchar(256) DEFAULT NULL,
  `json` json DEFAULT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`fromId`,`toId`,`relation`),
  KEY `from_index` (`fromId`,`relation`),
  KEY `to_index` (`toId`,`relation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_usage`
--

DROP TABLE IF EXISTS `entity_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entity_usage` (
  `id` varchar(36) NOT NULL,
  `entityType` varchar(20) NOT NULL,
  `usageDate` date DEFAULT NULL,
  `count1` int DEFAULT NULL,
  `count7` int DEFAULT NULL,
  `count30` int DEFAULT NULL,
  `percentile1` int DEFAULT NULL,
  `percentile7` int DEFAULT NULL,
  `percentile30` int DEFAULT NULL,
  UNIQUE KEY `usageDate` (`usageDate`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `event_subscription_entity`
--

DROP TABLE IF EXISTS `event_subscription_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_subscription_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `field_relationship`
--

DROP TABLE IF EXISTS `field_relationship`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `field_relationship` (
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
  KEY `to_fqnhash_index` (`toFQNHash`,`relation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `glossary_entity`
--

DROP TABLE IF EXISTS `glossary_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `glossary_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `glossary_term_entity`
--

DROP TABLE IF EXISTS `glossary_term_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `glossary_term_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ingestion_pipeline_entity`
--

DROP TABLE IF EXISTS `ingestion_pipeline_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ingestion_pipeline_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `timestamp` bigint DEFAULT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `kpi_entity`
--

DROP TABLE IF EXISTS `kpi_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messaging_service_entity`
--

DROP TABLE IF EXISTS `messaging_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messaging_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `metadata_service_entity`
--

DROP TABLE IF EXISTS `metadata_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `metadata_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `metric_entity`
--

DROP TABLE IF EXISTS `metric_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `metric_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ml_model_entity`
--

DROP TABLE IF EXISTS `ml_model_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ml_model_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mlmodel_service_entity`
--

DROP TABLE IF EXISTS `mlmodel_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mlmodel_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `openmetadata_settings`
--

DROP TABLE IF EXISTS `openmetadata_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `openmetadata_settings` (
  `id` mediumint NOT NULL AUTO_INCREMENT,
  `configType` varchar(36) NOT NULL,
  `json` json NOT NULL,
  PRIMARY KEY (`id`,`configType`),
  UNIQUE KEY `configType` (`configType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pipeline_entity`
--

DROP TABLE IF EXISTS `pipeline_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pipeline_service_entity`
--

DROP TABLE IF EXISTS `pipeline_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `policy_entity`
--

DROP TABLE IF EXISTS `policy_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `policy_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `query_entity`
--

DROP TABLE IF EXISTS `query_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `query_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`),
  KEY `name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_entity`
--

DROP TABLE IF EXISTS `report_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_entity`
--

DROP TABLE IF EXISTS `role_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `search_index_entity`
--

DROP TABLE IF EXISTS `search_index_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_index_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `search_service_entity`
--

DROP TABLE IF EXISTS `search_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SERVER_CHANGE_LOG`
--

DROP TABLE IF EXISTS `SERVER_CHANGE_LOG`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SERVER_CHANGE_LOG` (
  `installed_rank` bigint unsigned NOT NULL AUTO_INCREMENT,
  `version` varchar(256) NOT NULL,
  `migrationFileName` varchar(256) NOT NULL,
  `checksum` varchar(256) NOT NULL,
  `installed_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`),
  UNIQUE KEY `installed_rank` (`installed_rank`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `SERVER_MIGRATION_SQL_LOGS`
--

DROP TABLE IF EXISTS `SERVER_MIGRATION_SQL_LOGS`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SERVER_MIGRATION_SQL_LOGS` (
  `version` varchar(256) NOT NULL,
  `sqlStatement` varchar(10000) NOT NULL,
  `checksum` varchar(256) NOT NULL,
  `executedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`checksum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_container_entity`
--

DROP TABLE IF EXISTS `storage_container_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_container_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_service_entity`
--

DROP TABLE IF EXISTS `storage_service_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_service_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `serviceType` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.serviceType'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `table_entity`
--

DROP TABLE IF EXISTS `table_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `table_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tag`
--

DROP TABLE IF EXISTS `tag`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tag` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tag_usage`
--

DROP TABLE IF EXISTS `tag_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tag_usage` (
  `source` tinyint NOT NULL,
  `tagFQN` varchar(256) NOT NULL,
  `labelType` tinyint NOT NULL,
  `state` tinyint NOT NULL,
  `tagFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `targetFQNHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `tag_usage_key` (`source`,`tagFQNHash`,`targetFQNHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `task_sequence`
--

DROP TABLE IF EXISTS `task_sequence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_sequence` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `team_entity`
--

DROP TABLE IF EXISTS `team_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `teamType` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.teamType'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `test_case`
--

DROP TABLE IF EXISTS `test_case`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_case` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `entityFQN` varchar(1024) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityFQN'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `test_connection_definition`
--

DROP TABLE IF EXISTS `test_connection_definition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_connection_definition` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fullyQualifiedName` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.fullyQualifiedName'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `test_definition`
--

DROP TABLE IF EXISTS `test_definition`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_definition` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `entityType` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityType'))) VIRTUAL NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `supported_data_types` json GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.supportedDataTypes')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `test_suite`
--

DROP TABLE IF EXISTS `test_suite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_suite` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  UNIQUE KEY `nameHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `thread_entity`
--

DROP TABLE IF EXISTS `thread_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `thread_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `entityId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityId'))) VIRTUAL NOT NULL,
  `entityLink` varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.about'))) VIRTUAL NOT NULL,
  `assignedTo` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.addressedTo'))) VIRTUAL,
  `json` json NOT NULL,
  `createdAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.threadTs'))) STORED NOT NULL,
  `createdBy` varchar(256) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdBy'))) STORED NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `resolved` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.resolved')) VIRTUAL,
  `type` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.type'))) VIRTUAL,
  `taskId` int unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.task.id'))) VIRTUAL,
  `taskStatus` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.task.status'))) VIRTUAL,
  `taskAssignees` json GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.task.assignees')) VIRTUAL,
  `announcementStart` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.announcement.startTime'))) VIRTUAL,
  `announcementEnd` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.announcement.endTime'))) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_id_constraint` (`taskId`),
  KEY `created_by_index` (`createdBy`),
  KEY `thread_type_index` (`type`),
  KEY `task_status_index` (`taskStatus`),
  KEY `updated_at_index` (`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `topic_entity`
--

DROP TABLE IF EXISTS `topic_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `type_entity`
--

DROP TABLE IF EXISTS `type_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `type_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `category` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.category'))) VIRTUAL NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_entity`
--

DROP TABLE IF EXISTS `user_entity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `email` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.email'))) VIRTUAL NOT NULL,
  `deactivated` varchar(8) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.deactivated'))) VIRTUAL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `nameHash` varchar(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `nameHash` (`nameHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_tokens`
--

DROP TABLE IF EXISTS `user_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_tokens` (
  `token` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.token'))) STORED NOT NULL,
  `userId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.userId'))) STORED NOT NULL,
  `tokenType` varchar(50) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.tokenType'))) STORED NOT NULL,
  `json` json NOT NULL,
  `expiryDate` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.expiryDate'))) VIRTUAL,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `web_analytic_event`
--

DROP TABLE IF EXISTS `web_analytic_event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `web_analytic_event` (
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
  KEY `name_index` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
