/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.util.dbtune;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Static catalog of which tables get which MySQL/InnoDB persistent-stats reloptions, and the
 * row-count threshold below which we skip tuning that table.
 *
 * <p>InnoDB does not expose autovacuum knobs at the per-table level — purge is global. The lever
 * that DOES help on large hot tables is bumping {@code STATS_SAMPLE_PAGES} above the default 20 so
 * the planner picks the right index against multi-GB JSONB heaps. {@code STATS_PERSISTENT=1} +
 * {@code STATS_AUTO_RECALC=1} are the modern InnoDB defaults; we assert them explicitly so a
 * tenant with stale my.cnf overrides converges.
 */
final class MysqlTuningCatalog {

  static final String STATS_PERSISTENT = "STATS_PERSISTENT";
  static final String STATS_AUTO_RECALC = "STATS_AUTO_RECALC";
  static final String STATS_SAMPLE_PAGES = "STATS_SAMPLE_PAGES";

  record Profile(Map<String, String> settings, long rowThreshold, boolean relax, String reason) {
    Profile {
      settings = Map.copyOf(settings);
    }
  }

  private static final Map<String, String> HOT =
      Map.of(
          STATS_PERSISTENT, "1",
          STATS_AUTO_RECALC, "1",
          STATS_SAMPLE_PAGES, "100");

  private static final Map<String, String> ENTITY_LARGE =
      Map.of(
          STATS_PERSISTENT, "1",
          STATS_AUTO_RECALC, "1",
          STATS_SAMPLE_PAGES, "64");

  private static final Map<String, String> ENTITY_SERVICE =
      Map.of(
          STATS_PERSISTENT, "1",
          STATS_AUTO_RECALC, "1",
          STATS_SAMPLE_PAGES, "32");

  private static final long ROW_THRESHOLD_HOT = 0;
  private static final long ROW_THRESHOLD_ENTITY_LARGE = 10_000;
  private static final long ROW_THRESHOLD_ENTITY_SERVICE = 5_000;

  private static final Map<String, Profile> CATALOG = buildCatalog();

  private MysqlTuningCatalog() {}

  static Map<String, Profile> catalog() {
    return CATALOG;
  }

  static Set<String> tableNames() {
    return CATALOG.keySet();
  }

  static Profile profileFor(final String tableName) {
    return CATALOG.get(tableName);
  }

  private static Map<String, Profile> buildCatalog() {
    Map<String, Profile> map = new LinkedHashMap<>();
    map.put(
        "entity_relationship",
        new Profile(HOT, ROW_THRESHOLD_HOT, false, "Join target; raise sampling for planner"));
    map.put("tag_usage", new Profile(HOT, ROW_THRESHOLD_HOT, false, "Hottest table on read path"));
    addEntityLarge(map);
    addEntityService(map);
    return Map.copyOf(map);
  }

  private static void addEntityLarge(final Map<String, Profile> map) {
    String reason = "Large entity table; bump InnoDB stats sampling";
    for (String t :
        new String[] {
          "storage_container_entity",
          "table_entity",
          "dashboard_entity",
          "pipeline_entity",
          "chart_entity",
          "topic_entity",
          "ml_model_entity",
          "glossary_term_entity",
          "metric_entity",
          "report_entity",
          "search_index_entity",
          "api_collection_entity",
          "api_endpoint_entity",
          "dashboard_data_model_entity",
          "ingestion_pipeline_entity",
          "data_contract_entity",
          "stored_procedure_entity",
          "directory_entity",
          "file_entity",
          "spreadsheet_entity",
          "worksheet_entity",
          "query_entity"
        }) {
      map.put(t, new Profile(ENTITY_LARGE, ROW_THRESHOLD_ENTITY_LARGE, false, reason));
    }
  }

  private static void addEntityService(final Map<String, Profile> map) {
    String reason = "Service-tier table; mild stats sampling bump";
    map.put(
        "database_entity",
        new Profile(ENTITY_SERVICE, ROW_THRESHOLD_ENTITY_SERVICE, false, reason));
    map.put(
        "database_schema_entity",
        new Profile(ENTITY_SERVICE, ROW_THRESHOLD_ENTITY_SERVICE, false, reason));
  }
}
