/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.LLMModel.GovernanceStatus;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.utils.JsonUtils;

class AIGovernanceAssetSeedLoaderTest {
  private static final String LLM_SERVICES_DIR_PATTERN =
      ".*json/data/aiGovernance/services/llm/.*\\.json$";
  private static final String MCP_SERVICES_DIR_PATTERN =
      ".*json/data/aiGovernance/services/mcp/.*\\.json$";
  private static final String LLM_MODELS_DIR_PATTERN =
      ".*json/data/aiGovernance/llmModels/.*\\.json$";
  private static final String MCP_SERVERS_DIR_PATTERN =
      ".*json/data/aiGovernance/mcpServers/.*\\.json$";
  private static final String APPLICATIONS_DIR_PATTERN =
      ".*json/data/aiGovernance/applications/.*\\.json$";
  private static final String LINEAGE_DIR_PATTERN = ".*json/data/aiGovernance/lineage/.*\\.json$";
  private static final TypeReference<List<Map<String, String>>> LINEAGE_SEED_TYPE =
      new TypeReference<>() {};

  @Test
  void demoAssetFixturesParseWithExpectedCountsAndStatuses() throws IOException {
    List<LLMService> llmServices = readSeeds(LLM_SERVICES_DIR_PATTERN, LLMService.class);
    List<McpService> mcpServices = readSeeds(MCP_SERVICES_DIR_PATTERN, McpService.class);
    List<LLMModel> models = readSeeds(LLM_MODELS_DIR_PATTERN, LLMModel.class);
    List<McpServer> servers = readSeeds(MCP_SERVERS_DIR_PATTERN, McpServer.class);

    assertEquals(1, llmServices.size());
    assertEquals(1, mcpServices.size());
    assertEquals(6, models.size());
    assertEquals(5, servers.size());

    assertEquals(
        3,
        models.stream()
            .filter(model -> model.getGovernanceStatus() == GovernanceStatus.APPROVED)
            .count());
    assertTrue(
        models.stream()
            .anyMatch(model -> model.getGovernanceStatus() == GovernanceStatus.PENDING_REVIEW));
    assertTrue(
        models.stream()
            .anyMatch(model -> model.getGovernanceStatus() == GovernanceStatus.REJECTED));
    assertTrue(
        models.stream()
            .anyMatch(model -> model.getGovernanceStatus() == GovernanceStatus.UNAUTHORIZED));

    models.forEach(
        model -> {
          assertNotNull(model.getName());
          assertNotNull(model.getModelType());
          assertNotNull(model.getBaseModel());
          assertFalse(model.getDescription().isBlank());
          assertNotNull(model.getCostMetrics());
        });

    servers.forEach(
        server -> {
          assertNotNull(server.getName());
          assertNotNull(server.getServerType());
          assertFalse(server.getDescription().isBlank());
          assertNotNull(server.getGovernanceMetadata());
          assertNotNull(server.getUsageMetrics());
          assertNotNull(server.getSecurityMetrics());
        });
  }

  @Test
  void applicationFixturesReferenceSeededModelsAndServers() throws IOException {
    List<AIApplication> applications = readSeeds(APPLICATIONS_DIR_PATTERN, AIApplication.class);

    assertEquals(4, applications.size());
    applications.forEach(
        application -> {
          assertFalse(application.getModelConfigurations().isEmpty());
          assertTrue(
              application.getModelConfigurations().stream()
                  .allMatch(
                      modelConfiguration ->
                          modelConfiguration
                              .getModel()
                              .getFullyQualifiedName()
                              .startsWith("ai_governance_llm.")));
        });
    assertTrue(
        applications.stream()
            .filter(application -> application.getMcpServers() != null)
            .flatMap(application -> application.getMcpServers().stream())
            .allMatch(server -> server.getFullyQualifiedName().startsWith("ai_governance_mcp.")));
  }

  @Test
  void lineageFixturesReferenceSeededAiAssets() throws IOException {
    Set<String> applications =
        readSeeds(APPLICATIONS_DIR_PATTERN, AIApplication.class).stream()
            .map(AIApplication::getName)
            .collect(Collectors.toSet());
    Set<String> models =
        readSeeds(LLM_MODELS_DIR_PATTERN, LLMModel.class).stream()
            .map(model -> "ai_governance_llm." + model.getName())
            .collect(Collectors.toSet());
    Set<String> servers =
        readSeeds(MCP_SERVERS_DIR_PATTERN, McpServer.class).stream()
            .map(server -> "ai_governance_mcp." + server.getName())
            .collect(Collectors.toSet());

    List<Map<String, String>> lineageSeeds = readLineageSeeds();

    assertEquals(11, lineageSeeds.size());
    lineageSeeds.forEach(
        seed -> {
          assertFalse(seed.get("description").isBlank());
          assertKnownReference(
              seed.get("fromType"), seed.get("fromFqn"), applications, models, servers);
          assertKnownReference(
              seed.get("toType"), seed.get("toFqn"), applications, models, servers);
        });
    assertTrue(
        lineageSeeds.stream()
            .anyMatch(
                seed -> seed.get("fromFqn").equals("ai_governance_mcp.security_ticket_triage")));
    assertTrue(
        lineageSeeds.stream()
            .anyMatch(seed -> seed.get("fromFqn").equals("ai_governance_mcp.code_repo_assistant")));
  }

  private <T> List<T> readSeeds(String pattern, Class<T> clazz) throws IOException {
    return CommonUtil.getResources(Pattern.compile(pattern)).stream()
        .map(seedFile -> readSeed(seedFile, clazz))
        .toList();
  }

  private <T> T readSeed(String seedFile, Class<T> clazz) {
    try {
      String json = CommonUtil.getResourceAsStream(getClass().getClassLoader(), seedFile);
      return JsonUtils.readValue(json, clazz);
    } catch (IOException | RuntimeException e) {
      throw new IllegalStateException("Failed to parse seed " + seedFile, e);
    }
  }

  private List<Map<String, String>> readLineageSeeds() throws IOException {
    return CommonUtil.getResources(Pattern.compile(LINEAGE_DIR_PATTERN)).stream()
        .flatMap(seedFile -> readLineageSeed(seedFile).stream())
        .toList();
  }

  private List<Map<String, String>> readLineageSeed(String seedFile) {
    try {
      String json = CommonUtil.getResourceAsStream(getClass().getClassLoader(), seedFile);
      return JsonUtils.readValue(json, LINEAGE_SEED_TYPE);
    } catch (IOException | RuntimeException e) {
      throw new IllegalStateException("Failed to parse lineage seed " + seedFile, e);
    }
  }

  private void assertKnownReference(
      String entityType,
      String fqn,
      Set<String> applications,
      Set<String> models,
      Set<String> servers) {
    switch (entityType) {
      case "aiApplication" -> assertTrue(applications.contains(fqn));
      case "llmModel" -> assertTrue(models.contains(fqn));
      case "mcpServer" -> assertTrue(servers.contains(fqn));
      default -> throw new IllegalArgumentException("Unexpected lineage entity type " + entityType);
    }
  }
}
