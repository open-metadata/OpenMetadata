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
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;

@Slf4j
final class PolicySeedLoader {
  private static final String SEED_PATH_PATTERN = ".*json/data/aiGovernance/policies/.*\\.json$";
  private static final String ADMIN_USER_NAME = "admin";

  private PolicySeedLoader() {}

  static void loadFromResources(AIGovernancePolicyRepository policyRepository) throws IOException {
    List<String> seedFiles = CommonUtil.getResources(Pattern.compile(SEED_PATH_PATTERN));
    for (String seedFile : seedFiles) {
      try {
        seedPolicy(seedFile, policyRepository);
      } catch (Exception e) {
        LOG.warn("Failed to load policy seed {}: {}", seedFile, e.getMessage(), e);
      }
    }
  }

  private static void seedPolicy(String seedFile, AIGovernancePolicyRepository policyRepository)
      throws Exception {
    String json = CommonUtil.getResourceAsStream(PolicySeedLoader.class.getClassLoader(), seedFile);
    AIGovernancePolicy policy = JsonUtils.readValue(json, AIGovernancePolicy.class);

    AIGovernancePolicy existing = policyRepository.findByNameOrNull(policy.getName(), Include.ALL);
    if (existing != null) {
      LOG.debug("Policy '{}' already initialized", existing.getName());
      return;
    }
    policy.setId(UUID.randomUUID());
    policy.setFullyQualifiedName(policy.getName());
    policy.setUpdatedBy(ADMIN_USER_NAME);
    policy.setUpdatedAt(System.currentTimeMillis());
    policyRepository.create(null, policy);
    LOG.info("Seeded AI governance policy '{}'", policy.getName());
  }
}
