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

package org.openmetadata.service.fernet.rotation;

import java.util.Locale;
import java.util.Set;

/**
 * The tables a run leaves out unless {@code --every-table} is given: the large tables of this
 * release that cannot hold a secret (data assets, event and execution logs, relationships, stored
 * documents) and every time series table. The names are a copy of the 2.1 migration's list, which
 * is frozen, without {@code change_revision}: an approval revision keeps a service connection's
 * secrets encrypted (ADR:2026-10-29-service-connection-secrets-are-written-only-during-storage).
 * Everything else, including a table nobody listed, is read in both scopes.
 */
final class LargeTables {
  private static final String TIME_SERIES_SUFFIX = "_time_series";
  private static final Set<String> SKIPPED =
      Set.of(
          "table_entity",
          "database_entity",
          "database_schema_entity",
          "dashboard_entity",
          "chart_entity",
          "dashboard_data_model_entity",
          "pipeline_entity",
          "topic_entity",
          "ml_model_entity",
          "llm_model_entity",
          "storage_container_entity",
          "search_index_entity",
          "stored_procedure_entity",
          "api_collection_entity",
          "api_endpoint_entity",
          "query_entity",
          "metric_entity",
          "glossary_entity",
          "glossary_term_entity",
          "tag",
          "classification",
          "test_case",
          "data_contract_entity",
          "data_product_entity",
          "domain_entity",
          "directory_entity",
          "file_entity",
          "spreadsheet_entity",
          "worksheet_entity",
          "type_entity",
          "change_event",
          "successful_sent_change_events",
          "consumers_dlq",
          "change_event_consumers",
          "change_lifecycle_event",
          "agent_execution_entity",
          "mcp_execution_entity",
          "activity_stream",
          "thread_entity",
          "thread_entity_archived",
          "task_entity",
          "conversation_entity",
          "conversation_reply",
          "announcement_entity",
          "web_analytic_event",
          "entity_relationship",
          "field_relationship",
          "context_file",
          "context_file_content",
          "context_memory",
          "doc_store");

  private LargeTables() {}

  static boolean isLarge(String table) {
    String name = table.toLowerCase(Locale.ROOT);
    return name.endsWith(TIME_SERIES_SUFFIX) || SKIPPED.contains(name);
  }
}
