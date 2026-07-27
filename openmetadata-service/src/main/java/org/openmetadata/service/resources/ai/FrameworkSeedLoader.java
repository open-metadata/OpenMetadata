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

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIFrameworkControlRepository;
import org.openmetadata.service.jdbi3.AIGovernanceFrameworkRepository;

@Slf4j
final class FrameworkSeedLoader {
  private static final String SEED_PATH_PATTERN =
      ".*json/data/aiGovernance/frameworks/(?!_index\\.json).*\\.json$";
  private static final String ADMIN_USER_NAME = "admin";

  private FrameworkSeedLoader() {}

  static void loadFromResources(
      AIGovernanceFrameworkRepository frameworkRepository,
      AIFrameworkControlRepository controlRepository)
      throws IOException {
    List<String> seedFiles = CommonUtil.getResources(Pattern.compile(SEED_PATH_PATTERN));
    for (String seedFile : seedFiles) {
      try {
        seedBundle(seedFile, frameworkRepository, controlRepository);
      } catch (Exception e) {
        LOG.warn("Failed to load framework seed {}: {}", seedFile, e.getMessage(), e);
      }
    }
  }

  private static void seedBundle(
      String seedFile,
      AIGovernanceFrameworkRepository frameworkRepository,
      AIFrameworkControlRepository controlRepository)
      throws Exception {
    String json =
        CommonUtil.getResourceAsStream(FrameworkSeedLoader.class.getClassLoader(), seedFile);
    JsonNode root = JsonUtils.readTree(json);
    JsonNode frameworkNode = root.path("framework");
    if (frameworkNode.isMissingNode()) {
      LOG.warn("Seed {} has no 'framework' block, skipping", seedFile);
      return;
    }
    AIGovernanceFramework framework =
        JsonUtils.treeToValue(frameworkNode, AIGovernanceFramework.class);

    AIGovernanceFramework existing =
        frameworkRepository.findByNameOrNull(framework.getName(), Include.ALL);
    AIGovernanceFramework saved;
    if (existing == null) {
      framework.setId(UUID.randomUUID());
      framework.setFullyQualifiedName(framework.getName());
      framework.setUpdatedBy(ADMIN_USER_NAME);
      framework.setUpdatedAt(System.currentTimeMillis());
      saved = frameworkRepository.create(null, framework);
      LOG.info("Seeded AI governance framework '{}'", saved.getName());
    } else {
      saved = existing;
      LOG.debug("Framework '{}' already initialized", saved.getName());
    }

    JsonNode controlsNode = root.path("controls");
    if (!controlsNode.isArray()) {
      return;
    }
    EntityReference frameworkRef = saved.getEntityReference();
    for (JsonNode controlNode : controlsNode) {
      AIFrameworkControl control = JsonUtils.treeToValue(controlNode, AIFrameworkControl.class);
      String fqn = saved.getName() + "." + control.getName();
      AIFrameworkControl existingControl = controlRepository.findByNameOrNull(fqn, Include.ALL);
      if (existingControl != null) {
        continue;
      }
      control.setFramework(frameworkRef);
      control.setFullyQualifiedName(fqn);
      control.setId(UUID.randomUUID());
      control.setUpdatedBy(ADMIN_USER_NAME);
      control.setUpdatedAt(System.currentTimeMillis());
      controlRepository.create(null, control);
    }
  }

  static AIFrameworkControlRepository controlRepository() {
    return (AIFrameworkControlRepository) Entity.getEntityRepository(Entity.AI_FRAMEWORK_CONTROL);
  }
}
