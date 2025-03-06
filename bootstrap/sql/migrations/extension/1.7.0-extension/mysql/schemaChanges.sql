--
-- Table structure for table `geo_entity`
--

CREATE TABLE `geo_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`),
  KEY `name` (`name`)
);

CREATE TABLE `trigger_entity` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `json` json NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) VIRTUAL NOT NULL,
  `updatedBy` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedBy'))) VIRTUAL NOT NULL,
  `deleted` tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) VIRTUAL,
  `fqnHash` varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `name` varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fqnHash` (`fqnHash`)
);
