/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.security.policyevaluator;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Rule;
import org.jeasy.rules.api.Rules;
import org.jeasy.rules.core.RuleBuilder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

/** Subject context used for Access Control Policies */
@Slf4j
public class PolicyCache {
  private static final LoadingCache<UUID, Rules> POLICY_CACHE =
      CacheBuilder.newBuilder().maximumSize(100).build(new PolicyLoader());

  public static Rules getPolicyRules(UUID policyId) {
    try {
      return POLICY_CACHE.get(policyId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public static void invalidatePolicy(UUID policyId) {
    try {
      POLICY_CACHE.invalidate(policyId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for policy {}", policyId, ex);
    }
  }

  static class PolicyLoader extends CacheLoader<UUID, Rules> {
    private static final EntityRepository<Policy> POLICY_REPOSITORY = Entity.getEntityRepository(Entity.POLICY);
    private static final Fields FIELDS = POLICY_REPOSITORY.getFields("rules");

    @Override
    public Rules load(@CheckForNull UUID policyId) throws IOException {
      Policy policy = POLICY_REPOSITORY.get(null, policyId.toString(), FIELDS);
      LOG.info("Loaded policy {}:{}", policy.getName(), policy.getId());
      return getRules(policy);
    }

    private Rules getRules(Policy policy) {
      Rules rules = new Rules();
      for (Object r : policy.getRules()) {
        org.openmetadata.catalog.entity.policies.accessControl.Rule acRule = null;
        try {
          acRule =
              JsonUtils.readValue(
                  JsonUtils.getJsonStructure(r).toString(),
                  org.openmetadata.catalog.entity.policies.accessControl.Rule.class);
        } catch (Exception e) {
          LOG.warn("Failed to load a rule", e);
        }
        if (acRule != null && Boolean.TRUE.equals(acRule.getAllow())) {
          rules.register(convertRule(acRule));
        }
      }
      return rules;
    }

    private Rule convertRule(org.openmetadata.catalog.entity.policies.accessControl.Rule rule) {
      return new RuleBuilder()
          .name(rule.getName())
          .description(rule.getName())
          .priority(rule.getPriority())
          .when(new RuleCondition(rule))
          .then(new SetPermissionAction(rule))
          .then(new SetAllowedOperationAction(rule))
          .build();
    }
  }
}
