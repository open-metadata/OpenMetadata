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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class PolicyCache {
  private static final PolicyCache INSTANCE = new PolicyCache();
  private static volatile boolean initialized = false;

  protected static LoadingCache<UUID, List<CompiledRule>> policyCache;
  private static PolicyRepository policyRepository;
  private static Fields fields;

  public static PolicyCache getInstance() {
    return INSTANCE;
  }

  /** To be called during application startup by Default Authorizer */
  public static void initialize() {
    if (!initialized) {
      policyCache =
          CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new PolicyLoader());
      policyRepository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
      fields = policyRepository.getFields("rules");
      initialized = true;
    }
  }

  public List<CompiledRule> getPolicyRules(UUID policyId) {
    try {
      return policyCache.get(policyId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public void invalidatePolicy(UUID policyId) {
    try {
      policyCache.invalidate(policyId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for policy {}", policyId, ex);
    }
  }

  protected List<CompiledRule> getRules(Policy policy) {
    List<CompiledRule> rules = new ArrayList<>();
    for (Rule r : policy.getRules()) {
      rules.add(new CompiledRule(r));
    }
    return rules;
  }

  public static void cleanUp() {
    policyCache.cleanUp();
    initialized = false;
  }

  static class PolicyLoader extends CacheLoader<UUID, List<CompiledRule>> {
    @Override
    public List<CompiledRule> load(@CheckForNull UUID policyId) throws IOException {
      Policy policy = policyRepository.get(null, policyId, fields);
      LOG.info("Loaded policy {}:{}", policy.getName(), policy.getId());
      return PolicyCache.getInstance().getRules(policy);
    }
  }
}
