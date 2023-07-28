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

package org.openmetadata.service.security.policyevaluator;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Subject context used for Access Control Policies */
@Slf4j
public class PolicyCache {
  protected static final LoadingCache<UUID, List<CompiledRule>> CACHE =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new PolicyLoader());

  public static List<CompiledRule> getPolicyRules(UUID policyId) {
    try {
      return CACHE.get(policyId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public static void invalidatePolicy(UUID policyId) {
    try {
      CACHE.invalidate(policyId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for policy {}", policyId, ex);
    }
  }

  protected static List<CompiledRule> getRules(Policy policy) {
    List<CompiledRule> rules = new ArrayList<>();
    for (Rule r : policy.getRules()) {
      rules.add(new CompiledRule(r));
    }
    return rules;
  }

  public static void cleanUp() {
    CACHE.cleanUp();
  }

  static class PolicyLoader extends CacheLoader<UUID, List<CompiledRule>> {
    @Override
    public List<CompiledRule> load(@CheckForNull UUID policyId) throws IOException {
      Policy policy = Entity.getEntity(Entity.POLICY, policyId, "rules", Include.NON_DELETED);
      LOG.info("Loaded policy {}:{}", policy.getName(), policy.getId());
      return PolicyCache.getRules(policy);
    }
  }
}
