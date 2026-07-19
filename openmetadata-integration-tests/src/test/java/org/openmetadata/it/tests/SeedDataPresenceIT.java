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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.seeding.RequiredSeedRows;
import org.openmetadata.service.seeding.RequiredSeedRows.SeedTable;

class SeedDataPresenceIT {
  private static final String MISSING_SEED_NAME = "missing-seed-row";

  @Test
  void countsOnlyPresentRequiredSeedRows() {
    TestSuiteBootstrap.getJdbi()
        .useExtension(
            CollectionDAO.class,
            collectionDAO -> {
              SystemDAO systemDAO = collectionDAO.systemDAO();
              RequiredSeedRows requiredSeedRows = representativeSeedRows();
              assertEquals(requiredSeedRows.expectedCount(), count(systemDAO, requiredSeedRows));

              for (Map.Entry<SeedTable, List<String>> entry : requiredSeedRows.rows().entrySet()) {
                if (entry.getValue().isEmpty()) {
                  continue;
                }
                RequiredSeedRows missingOne = withMissingIdentity(requiredSeedRows, entry.getKey());
                assertEquals(
                    requiredSeedRows.expectedCount() - 1,
                    count(systemDAO, missingOne),
                    "Expected missing row detection for " + entry.getKey());
              }
            });
  }

  private static RequiredSeedRows representativeSeedRows() {
    EnumMap<SeedTable, List<String>> rows = new EnumMap<>(SeedTable.class);
    rows.put(SeedTable.TYPE, List.of("table"));
    rows.put(SeedTable.POLICY, List.of("OrganizationPolicy"));
    rows.put(SeedTable.ROLE, List.of("DataConsumer"));
    rows.put(SeedTable.TASK_FORM_SCHEMA, List.of("DataAccessRequest"));
    rows.put(SeedTable.DOCUMENT, List.of("KnowledgePanel.ActivityFeed"));
    rows.put(SeedTable.WORKFLOW_DEFINITION, List.of("AIAssetApprovalWorkflow"));
    rows.put(SeedTable.EVENT_SUBSCRIPTION, List.of("ActivityFeedAlert"));
    rows.put(SeedTable.NOTIFICATION_TEMPLATE, List.of("system-notification-entity-created"));
    rows.put(SeedTable.LEARNING_RESOURCE, List.of("CollateClues_GettingStarted"));
    rows.put(SeedTable.TEST_DEFINITION, List.of("tableRowCountToEqual"));
    rows.put(SeedTable.TEST_CONNECTION_DEFINITION, List.of("Rest.testConnectionDefinition"));
    rows.put(SeedTable.WEB_ANALYTIC_EVENT, List.of("CustomEvent"));
    rows.put(SeedTable.DATA_INSIGHT_CHART, List.of("AggregatedUnusedAssetsCount"));
    rows.put(SeedTable.BOT, List.of("ingestion-bot"));
    rows.put(SeedTable.CLASSIFICATION, List.of("Tier"));
    rows.put(SeedTable.TAG, List.of("Tier.Tier1"));
    rows.put(SeedTable.AI_GOVERNANCE_POLICY, List.of("drift_threshold"));
    rows.put(SeedTable.AI_GOVERNANCE_FRAMEWORK, List.of("canada_aida"));
    rows.put(SeedTable.AI_FRAMEWORK_CONTROL, List.of("aida-1"));
    rows.put(SeedTable.AI_APPLICATION, List.of("claims-triage-copilot"));
    rows.put(SeedTable.LLM_SERVICE, List.of("ai_governance_llm"));
    rows.put(SeedTable.LLM_MODEL, List.of("ai_governance_llm.gpt_4o_claims_prod"));
    rows.put(SeedTable.MCP_SERVICE, List.of("ai_governance_mcp"));
    rows.put(SeedTable.MCP_SERVER, List.of("ai_governance_mcp.code_repo_assistant"));
    return new RequiredSeedRows(rows, List.of(), List.of());
  }

  private static RequiredSeedRows withMissingIdentity(
      RequiredSeedRows requiredSeedRows, SeedTable table) {
    EnumMap<SeedTable, List<String>> rows = new EnumMap<>(requiredSeedRows.rows());
    rows.put(table, List.of(MISSING_SEED_NAME));
    return new RequiredSeedRows(rows, List.of(), List.of());
  }

  private static long count(SystemDAO systemDAO, RequiredSeedRows rows) {
    return systemDAO.countRequiredSeedData(
        rows.bindableIdentities(SeedTable.TYPE),
        rows.bindableIdentities(SeedTable.POLICY),
        rows.bindableIdentities(SeedTable.ROLE),
        rows.bindableIdentities(SeedTable.TASK_FORM_SCHEMA),
        rows.bindableIdentities(SeedTable.DOCUMENT),
        rows.bindableIdentities(SeedTable.WORKFLOW_DEFINITION),
        rows.bindableIdentities(SeedTable.EVENT_SUBSCRIPTION),
        rows.bindableIdentities(SeedTable.NOTIFICATION_TEMPLATE),
        rows.bindableIdentities(SeedTable.LEARNING_RESOURCE),
        rows.bindableIdentities(SeedTable.TEST_DEFINITION),
        rows.bindableIdentities(SeedTable.TEST_CONNECTION_DEFINITION),
        rows.bindableIdentities(SeedTable.WEB_ANALYTIC_EVENT),
        rows.bindableIdentities(SeedTable.DATA_INSIGHT_CHART),
        rows.bindableIdentities(SeedTable.DATA_INSIGHT_CUSTOM_CHART),
        rows.bindableIdentities(SeedTable.BOT),
        rows.bindableIdentities(SeedTable.CLASSIFICATION),
        rows.bindableIdentities(SeedTable.TAG),
        rows.bindableIdentities(SeedTable.GLOSSARY),
        rows.bindableIdentities(SeedTable.GLOSSARY_TERM),
        rows.bindableIdentities(SeedTable.AI_GOVERNANCE_POLICY),
        rows.bindableIdentities(SeedTable.AI_GOVERNANCE_FRAMEWORK),
        rows.bindableIdentities(SeedTable.AI_FRAMEWORK_CONTROL),
        rows.bindableIdentities(SeedTable.AI_APPLICATION),
        rows.bindableIdentities(SeedTable.LLM_SERVICE),
        rows.bindableIdentities(SeedTable.LLM_MODEL),
        rows.bindableIdentities(SeedTable.MCP_SERVICE),
        rows.bindableIdentities(SeedTable.MCP_SERVER));
  }
}
