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
 * Static catalog of which tables get which Postgres autovacuum reloptions, and the row-count
 * threshold below which we skip tuning that table (small dev installs don't need aggressive
 * autovacuum). Values come from production analysis of the 600k-container tenant.
 */
final class PostgresTuningCatalog {

  static final String AUTOVACUUM_VACUUM_SCALE_FACTOR = "autovacuum_vacuum_scale_factor";
  static final String AUTOVACUUM_ANALYZE_SCALE_FACTOR = "autovacuum_analyze_scale_factor";
  static final String AUTOVACUUM_VACUUM_COST_LIMIT = "autovacuum_vacuum_cost_limit";
  static final String AUTOVACUUM_VACUUM_COST_DELAY = "autovacuum_vacuum_cost_delay";

  /** A tuning recipe for one table. */
  record Profile(Map<String, String> settings, long rowThreshold, boolean relax, String reason) {
    Profile {
      settings = Map.copyOf(settings);
    }
  }

  private static final Map<String, String> HOT_RELATIONSHIP =
      Map.of(
          AUTOVACUUM_ANALYZE_SCALE_FACTOR, "0.005",
          AUTOVACUUM_VACUUM_SCALE_FACTOR, "0.01",
          AUTOVACUUM_VACUUM_COST_LIMIT, "4000");

  private static final Map<String, String> HOT_TAG_USAGE =
      Map.of(
          AUTOVACUUM_ANALYZE_SCALE_FACTOR, "0.005",
          AUTOVACUUM_VACUUM_SCALE_FACTOR, "0.01",
          AUTOVACUUM_VACUUM_COST_LIMIT, "4000",
          AUTOVACUUM_VACUUM_COST_DELAY, "0");

  private static final Map<String, String> ENTITY_LARGE =
      Map.of(
          AUTOVACUUM_ANALYZE_SCALE_FACTOR, "0.01",
          AUTOVACUUM_VACUUM_SCALE_FACTOR, "0.02");

  private static final Map<String, String> ENTITY_SERVICE =
      Map.of(
          AUTOVACUUM_ANALYZE_SCALE_FACTOR, "0.02",
          AUTOVACUUM_VACUUM_SCALE_FACTOR, "0.05");

  private static final Map<String, String> APPEND_ONLY =
      Map.of(
          AUTOVACUUM_ANALYZE_SCALE_FACTOR, "0.1",
          AUTOVACUUM_VACUUM_SCALE_FACTOR, "0.2");

  private static final long ROW_THRESHOLD_HOT = 0;
  private static final long ROW_THRESHOLD_ENTITY_LARGE = 10_000;
  private static final long ROW_THRESHOLD_ENTITY_SERVICE = 5_000;
  private static final long ROW_THRESHOLD_APPEND_ONLY = 50_000;

  private static final Map<String, Profile> CATALOG = buildCatalog();

  private PostgresTuningCatalog() {}

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
        new Profile(HOT_RELATIONSHIP, ROW_THRESHOLD_HOT, false, "Join target, write-heavy"));
    map.put(
        "tag_usage",
        new Profile(HOT_TAG_USAGE, ROW_THRESHOLD_HOT, false, "Hottest table on read path"));
    addEntityLarge(map);
    addEntityService(map);
    map.put(
        "change_event",
        new Profile(APPEND_ONLY, ROW_THRESHOLD_APPEND_ONLY, true, "Append-only, relax autovacuum"));
    return Map.copyOf(map);
  }

  private static void addEntityLarge(final Map<String, Profile> map) {
    String reason = "Large entity table; tighten autovacuum so list count stats stay fresh";
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
    String reason = "Service-tier table; mild tightening";
    map.put(
        "database_entity",
        new Profile(ENTITY_SERVICE, ROW_THRESHOLD_ENTITY_SERVICE, false, reason));
    map.put(
        "database_schema_entity",
        new Profile(ENTITY_SERVICE, ROW_THRESHOLD_ENTITY_SERVICE, false, reason));
  }
}
