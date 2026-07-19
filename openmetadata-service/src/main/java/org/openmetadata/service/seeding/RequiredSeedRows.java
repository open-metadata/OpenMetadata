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

package org.openmetadata.service.seeding;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public record RequiredSeedRows(
    Map<SeedTable, List<String>> rows,
    List<String> openMetadataEmailDocuments,
    List<String> collateEmailDocuments) {
  private static final String EMPTY_BIND_VALUE = "";

  public RequiredSeedRows {
    EnumMap<SeedTable, List<String>> immutableRows = new EnumMap<>(SeedTable.class);
    for (SeedTable table : SeedTable.values()) {
      immutableRows.put(table, List.copyOf(rows.getOrDefault(table, List.of())));
    }
    rows = Collections.unmodifiableMap(immutableRows);
    openMetadataEmailDocuments = List.copyOf(openMetadataEmailDocuments);
    collateEmailDocuments = List.copyOf(collateEmailDocuments);
  }

  public static RequiredSeedRows empty() {
    return new RequiredSeedRows(Map.of(), List.of(), List.of());
  }

  public List<String> identities(SeedTable table) {
    return rows.get(table);
  }

  public List<String> bindableIdentities(SeedTable table) {
    List<String> identities = identities(table);
    return identities.isEmpty() ? List.of(EMPTY_BIND_VALUE) : identities;
  }

  public int expectedCount() {
    return rows.values().stream().mapToInt(List::size).sum();
  }

  public RequiredSeedRows selectEmailDocuments(String templateProvider) {
    EnumMap<SeedTable, List<String>> selectedRows = new EnumMap<>(rows);
    List<String> documents = new ArrayList<>(identities(SeedTable.DOCUMENT));
    if (templateProvider == null) {
      documents.addAll(openMetadataEmailDocuments);
      documents.addAll(collateEmailDocuments);
    } else {
      documents.addAll(
          "collate".equals(templateProvider) ? collateEmailDocuments : openMetadataEmailDocuments);
    }
    selectedRows.put(SeedTable.DOCUMENT, documents.stream().distinct().sorted().toList());
    return new RequiredSeedRows(selectedRows, List.of(), List.of());
  }

  public enum SeedTable {
    TYPE,
    POLICY,
    ROLE,
    TASK_FORM_SCHEMA,
    DOCUMENT,
    WORKFLOW_DEFINITION,
    EVENT_SUBSCRIPTION,
    NOTIFICATION_TEMPLATE,
    LEARNING_RESOURCE,
    TEST_DEFINITION,
    TEST_CONNECTION_DEFINITION,
    WEB_ANALYTIC_EVENT,
    DATA_INSIGHT_CHART,
    DATA_INSIGHT_CUSTOM_CHART,
    BOT,
    CLASSIFICATION,
    TAG,
    GLOSSARY,
    GLOSSARY_TERM,
    AI_GOVERNANCE_POLICY,
    AI_GOVERNANCE_FRAMEWORK,
    AI_FRAMEWORK_CONTROL,
    AI_APPLICATION,
    LLM_SERVICE,
    LLM_MODEL,
    MCP_SERVICE,
    MCP_SERVER
  }
}
