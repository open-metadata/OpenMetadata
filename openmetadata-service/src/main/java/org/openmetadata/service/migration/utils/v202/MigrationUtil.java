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
package org.openmetadata.service.migration.utils.v202;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;

/**
 * v202 copies of the DataConsumerPolicy task-rule backfills. These intentionally duplicate the v200
 * helpers rather than importing them: a version's data migration only runs once, so an install that
 * already applied v200 (i.e. is on 2.0.0/2.0.1) never re-runs the v200 code. Such installs missed
 * {@code DataConsumerPolicy-CreateTask-Rule} because of the stale-L1-cache bug fixed for fresh
 * upgrades in v200 (#32668); running these copies from v202 repairs them. Keeping the logic
 * self-contained per version means fixing or evolving one release train cannot silently change the
 * behavior another already recorded.
 *
 * <p>Both helpers read past the L1 name cache ({@code findByName(..., false)}) and persist via {@link
 * #persistPolicyAndInvalidateCache} (raw write then cache invalidation) so back-to-back invocations
 * in one migrate JVM cannot overwrite each other with a stale snapshot. Idempotent — each skips when
 * its rule already exists.
 */
@Slf4j
public class MigrationUtil {

  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_TASK_RULE_NAME = "DataConsumerPolicy-CreateTask-Rule";
  private static final String TASK_RULE_NAME = "DataConsumerPolicy-TaskRule";

  private MigrationUtil() {}

  public static void addCreateTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED, false);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (CREATE_TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule createTaskRule =
            new Rule()
                .withName(CREATE_TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to create tasks"
                        + " (data access requests, suggestions, etc.).")
                .withResources(List.of("task"))
                .withOperations(List.of(MetadataOperation.CREATE))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(createTaskRule);
        persistPolicyAndInvalidateCache(collectionDAO, policy);
        LOG.info("Added {} rule to {}", CREATE_TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping CreateTask rule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}",
          CREATE_TASK_RULE_NAME,
          DATA_CONSUMER_POLICY,
          ex.getMessage(),
          ex);
    }
  }

  public static void addTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED, false);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule taskRule =
            new Rule()
                .withName(TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to file and edit tasks (data access requests,"
                        + " suggestions, etc.) against any entity. Restrict this rule (e.g. with"
                        + " an isOwner condition) to limit who can file or edit tasks on which"
                        + " entities.")
                .withResources(List.of("all"))
                .withOperations(List.of(MetadataOperation.CREATE_TASK, MetadataOperation.EDIT_TASK))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(taskRule);
        persistPolicyAndInvalidateCache(collectionDAO, policy);
        LOG.info("Added {} rule to {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping TaskRule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY, ex.getMessage(), ex);
    }
  }

  /**
   * Persist a policy edited during migration via the raw DAO and then evict it from the repository
   * caches. The raw {@code policyDAO().update(...)} writes the DB row but skips the invalidation
   * that {@link EntityRepository} performs on its own write path, so a later read of the same policy
   * in this migrate JVM would otherwise be served a stale L1 snapshot.
   */
  private static void persistPolicyAndInvalidateCache(CollectionDAO collectionDAO, Policy policy) {
    collectionDAO
        .policyDAO()
        .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
    EntityRepository.invalidateCacheForEntity(
        Entity.POLICY, policy.getId(), policy.getFullyQualifiedName());
  }
}
