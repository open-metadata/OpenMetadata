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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;

/**
 * Regression test for #32668, v202 repair copy: installs already on 2.0.0/2.0.1 never re-run v200,
 * so the v202 copies of the DataConsumerPolicy task-rule backfills repair them. These copies must be
 * cache-safe in their own right — the v202 {@code Migration} invokes the two helpers back-to-back in
 * one migrate JVM, the same shape that dropped {@code CreateTask-Rule} in v200.
 *
 * <p>Like the v200 test, this drives the production {@link EntityRepository#findByName} against the
 * real static {@code CACHE_WITH_NAME}, stubbing only the JDBI {@link CollectionDAO.PolicyDAO}
 * boundary — the only configuration in which the staleness bug reproduces.
 */
class MigrationUtilDataConsumerPolicyCacheTest {

  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_TASK_RULE_NAME = "DataConsumerPolicy-CreateTask-Rule";
  private static final String TASK_RULE_NAME = "DataConsumerPolicy-TaskRule";
  private static final String EXISTING_RULE_NAME = "DataConsumerPolicy-EditRule";

  private final Map<String, String> dbByFqn = new HashMap<>();
  private UUID policyId;
  private CollectionDAO collectionDAO;

  @BeforeEach
  void setUp() {
    policyId = UUID.randomUUID();
    // Simulate an upgraded 1.x install: DataConsumerPolicy exists but carries neither the
    // CreateTask-Rule nor the TaskRule that 2.0's seed JSON introduced.
    Policy seed =
        new Policy()
            .withId(policyId)
            .withName(DATA_CONSUMER_POLICY)
            .withFullyQualifiedName(DATA_CONSUMER_POLICY)
            .withRules(
                new ArrayList<>(
                    List.of(
                        new Rule()
                            .withName(EXISTING_RULE_NAME)
                            .withResources(new ArrayList<>(List.of("all")))
                            .withOperations(new ArrayList<>(List.of(MetadataOperation.EDIT_TAGS)))
                            .withEffect(Rule.Effect.ALLOW))));
    dbByFqn.put(DATA_CONSUMER_POLICY, JsonUtils.pojoToJson(seed));

    CollectionDAO.PolicyDAO policyDAO = mock(CollectionDAO.PolicyDAO.class);
    // Loader (cached findByName) path: production EntityLoaderWithName reads raw JSON via
    // findByName(table, nameHashColumn, fqn, condition). getTableName()/getNameHashColumn()/
    // getCondition(...) return null on the mock, so match them with any().
    when(policyDAO.findByName(any(), any(), eq(DATA_CONSUMER_POLICY), any()))
        .thenAnswer(inv -> dbByFqn.get(DATA_CONSUMER_POLICY));
    // Bypass (fresh) findByName path used by the fix reads through findEntityByName(fqn, include).
    when(policyDAO.findEntityByName(eq(DATA_CONSUMER_POLICY), any(Include.class)))
        .thenAnswer(inv -> JsonUtils.readValue(dbByFqn.get(DATA_CONSUMER_POLICY), Policy.class));
    // Raw EntityDAO.update(id, fqn, json) — writes the DB row without touching CACHE_WITH_NAME.
    doAnswer(
            inv -> {
              dbByFqn.put(inv.getArgument(1), inv.getArgument(2));
              return null;
            })
        .when(policyDAO)
        .update(any(UUID.class), anyString(), anyString());

    collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.policyDAO()).thenReturn(policyDAO);

    Entity.setCollectionDAO(collectionDAO);
    // Construct the real PolicyRepository so Entity.getEntityRepository(POLICY) returns a repo
    // whose findByName runs the production cache path against our stubbed DAO.
    new PolicyRepository();
    EntityRepository.CACHE_WITH_NAME.invalidate(
        new ImmutablePair<>(Entity.POLICY, DATA_CONSUMER_POLICY));
  }

  @AfterEach
  void tearDown() {
    EntityRepository.CACHE_WITH_NAME.invalidate(
        new ImmutablePair<>(Entity.POLICY, DATA_CONSUMER_POLICY));
    // new PolicyRepository() registered itself in Entity's static repository map bound to this
    // test's mock DAO; clear it so a later test in the same JVM can't resolve the dead repo.
    Entity.cleanup();
    Entity.setCollectionDAO(null);
  }

  @Test
  void backToBackTaskRuleMigrationsKeepBothRules() {
    MigrationUtil.addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);

    Policy finalPolicy = JsonUtils.readValue(dbByFqn.get(DATA_CONSUMER_POLICY), Policy.class);
    boolean hasCreateTaskRule = false;
    boolean hasTaskRule = false;
    for (Rule rule : finalPolicy.getRules()) {
      if (CREATE_TASK_RULE_NAME.equals(rule.getName())) {
        hasCreateTaskRule = true;
      }
      if (TASK_RULE_NAME.equals(rule.getName())) {
        hasTaskRule = true;
      }
    }

    assertTrue(hasTaskRule, "v202 should have added " + TASK_RULE_NAME);
    assertTrue(
        hasCreateTaskRule,
        "BUG #32668: the v202 copy must not read a stale L1 snapshot and drop "
            + CREATE_TASK_RULE_NAME
            + " when the two helpers run back-to-back.");
  }

  /**
   * The real v202 repair scenario: an install already upgraded to 2.0.0/2.0.1 carries the corrupted
   * state — {@code TaskRule} present but {@code CreateTask-Rule} dropped. The v202 helpers must
   * re-add the missing rule and must not duplicate the rule that already exists.
   */
  @Test
  void repairRestoresMissingCreateTaskRuleWithoutDuplicatingTaskRule() {
    Policy corrupted = JsonUtils.readValue(dbByFqn.get(DATA_CONSUMER_POLICY), Policy.class);
    corrupted
        .getRules()
        .add(
            new Rule()
                .withName(TASK_RULE_NAME)
                .withResources(new ArrayList<>(List.of("all")))
                .withOperations(new ArrayList<>(List.of(MetadataOperation.CREATE_TASK)))
                .withEffect(Rule.Effect.ALLOW));
    dbByFqn.put(DATA_CONSUMER_POLICY, JsonUtils.pojoToJson(corrupted));
    EntityRepository.CACHE_WITH_NAME.invalidate(
        new ImmutablePair<>(Entity.POLICY, DATA_CONSUMER_POLICY));

    MigrationUtil.addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);

    Policy repaired = JsonUtils.readValue(dbByFqn.get(DATA_CONSUMER_POLICY), Policy.class);
    long createTaskRules =
        repaired.getRules().stream().filter(r -> CREATE_TASK_RULE_NAME.equals(r.getName())).count();
    long taskRules =
        repaired.getRules().stream().filter(r -> TASK_RULE_NAME.equals(r.getName())).count();

    assertEquals(1, createTaskRules, "repair should re-add the dropped " + CREATE_TASK_RULE_NAME);
    assertEquals(1, taskRules, "repair must not duplicate the already-present " + TASK_RULE_NAME);
  }

  /**
   * The v202 repair must be idempotent: running the helpers a second time on an install that already
   * carries both rules is a no-op — no duplicate rules.
   */
  @Test
  void reRunningTheHelpersIsIdempotent() {
    MigrationUtil.addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);

    Policy finalPolicy = JsonUtils.readValue(dbByFqn.get(DATA_CONSUMER_POLICY), Policy.class);
    long createTaskRules =
        finalPolicy.getRules().stream()
            .filter(r -> CREATE_TASK_RULE_NAME.equals(r.getName()))
            .count();
    long taskRules =
        finalPolicy.getRules().stream().filter(r -> TASK_RULE_NAME.equals(r.getName())).count();

    assertEquals(1, createTaskRules, "re-running must not duplicate " + CREATE_TASK_RULE_NAME);
    assertEquals(1, taskRules, "re-running must not duplicate " + TASK_RULE_NAME);
  }
}
