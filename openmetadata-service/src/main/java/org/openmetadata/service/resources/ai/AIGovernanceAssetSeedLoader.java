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

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LLMModelRepository;
import org.openmetadata.service.jdbi3.LLMServiceRepository;
import org.openmetadata.service.jdbi3.McpServerRepository;
import org.openmetadata.service.jdbi3.McpServiceRepository;

@Slf4j
final class AIGovernanceAssetSeedLoader {
  private static final String ADMIN_USER = "admin";
  private static final String LLM_SERVICES_DIR_PATTERN =
      ".*json/data/aiGovernance/services/llm/.*\\.json$";
  private static final String MCP_SERVICES_DIR_PATTERN =
      ".*json/data/aiGovernance/services/mcp/.*\\.json$";
  private static final String LLM_MODELS_DIR_PATTERN =
      ".*json/data/aiGovernance/llmModels/.*\\.json$";
  private static final String MCP_SERVERS_DIR_PATTERN =
      ".*json/data/aiGovernance/mcpServers/.*\\.json$";

  private AIGovernanceAssetSeedLoader() {}

  static void loadFromResources() throws IOException {
    EntityReference llmService = seedLLMServices();
    EntityReference mcpService = seedMcpServices();
    seedLLMModels(llmService);
    seedMcpServers(mcpService);
  }

  private static EntityReference seedLLMServices() throws IOException {
    LLMServiceRepository repository =
        (LLMServiceRepository) Entity.getEntityRepository(Entity.LLM_SERVICE);
    EntityReference seededService = null;
    for (String seedFile : getSeedFiles(LLM_SERVICES_DIR_PATTERN)) {
      try {
        LLMService service = readSeed(seedFile, LLMService.class);
        LLMService stored = seedServiceIfMissing(repository, service);
        seededService = stored.getEntityReference();
      } catch (Exception e) {
        LOG.warn("AI Governance LLM service seed {} failed: {}", seedFile, e.getMessage(), e);
      }
    }
    return seededService;
  }

  private static EntityReference seedMcpServices() throws IOException {
    McpServiceRepository repository =
        (McpServiceRepository) Entity.getEntityRepository(Entity.MCP_SERVICE);
    EntityReference seededService = null;
    for (String seedFile : getSeedFiles(MCP_SERVICES_DIR_PATTERN)) {
      try {
        McpService service = readSeed(seedFile, McpService.class);
        McpService stored = seedServiceIfMissing(repository, service);
        seededService = stored.getEntityReference();
      } catch (Exception e) {
        LOG.warn("AI Governance MCP service seed {} failed: {}", seedFile, e.getMessage(), e);
      }
    }
    return seededService;
  }

  private static void seedLLMModels(EntityReference service) throws IOException {
    if (service == null) {
      LOG.warn("Skipping AI Governance LLM model seeds because no LLM service was seeded");
      return;
    }
    LLMModelRepository repository =
        (LLMModelRepository) Entity.getEntityRepository(Entity.LLM_MODEL);
    for (String seedFile : getSeedFiles(LLM_MODELS_DIR_PATTERN)) {
      try {
        LLMModel model = readSeed(seedFile, LLMModel.class).withService(service);
        prepareChildEntity(model, service);
        if (repository.findByNameOrNull(model.getFullyQualifiedName(), Include.ALL) == null) {
          repository.create(null, model);
          LOG.info("Seeded AI Governance LLM model '{}'", model.getFullyQualifiedName());
        }
      } catch (Exception e) {
        LOG.warn("AI Governance LLM model seed {} failed: {}", seedFile, e.getMessage(), e);
      }
    }
  }

  private static void seedMcpServers(EntityReference service) throws IOException {
    if (service == null) {
      LOG.warn("Skipping AI Governance MCP server seeds because no MCP service was seeded");
      return;
    }
    McpServerRepository repository =
        (McpServerRepository) Entity.getEntityRepository(Entity.MCP_SERVER);
    for (String seedFile : getSeedFiles(MCP_SERVERS_DIR_PATTERN)) {
      try {
        McpServer server = readSeed(seedFile, McpServer.class).withService(service);
        prepareChildEntity(server, service);
        if (repository.findByNameOrNull(server.getFullyQualifiedName(), Include.ALL) == null) {
          repository.create(null, server);
          LOG.info("Seeded AI Governance MCP server '{}'", server.getFullyQualifiedName());
        }
      } catch (Exception e) {
        LOG.warn("AI Governance MCP server seed {} failed: {}", seedFile, e.getMessage(), e);
      }
    }
  }

  private static LLMService seedServiceIfMissing(
      LLMServiceRepository repository, LLMService service) throws Exception {
    LLMService stored = repository.findByNameOrNull(service.getName(), Include.ALL);
    if (stored != null) {
      return stored;
    }
    prepareEntity(service);
    service.setFullyQualifiedName(service.getName());
    repository.create(null, service);
    LOG.info("Seeded AI Governance LLM service '{}'", service.getName());
    return service;
  }

  private static McpService seedServiceIfMissing(
      McpServiceRepository repository, McpService service) throws Exception {
    McpService stored = repository.findByNameOrNull(service.getName(), Include.ALL);
    if (stored != null) {
      return stored;
    }
    prepareEntity(service);
    service.setFullyQualifiedName(service.getName());
    repository.create(null, service);
    LOG.info("Seeded AI Governance MCP service '{}'", service.getName());
    return service;
  }

  private static void prepareChildEntity(EntityInterface entity, EntityReference service) {
    prepareEntity(entity);
    entity.setFullyQualifiedName(service.getFullyQualifiedName() + "." + entity.getName());
  }

  private static void prepareEntity(EntityInterface entity) {
    long now = System.currentTimeMillis();
    if (entity.getId() == null) {
      entity.setId(UUID.randomUUID());
    }
    if (entity.getUpdatedBy() == null) {
      entity.setUpdatedBy(ADMIN_USER);
    }
    if (entity.getUpdatedAt() == null) {
      entity.setUpdatedAt(now);
    }
  }

  private static List<String> getSeedFiles(String pattern) throws IOException {
    return CommonUtil.getResources(Pattern.compile(pattern));
  }

  private static <T> T readSeed(String seedFile, Class<T> clazz) throws IOException {
    String json =
        CommonUtil.getResourceAsStream(
            AIGovernanceAssetSeedLoader.class.getClassLoader(), seedFile);
    return JsonUtils.readValue(json, clazz);
  }
}
