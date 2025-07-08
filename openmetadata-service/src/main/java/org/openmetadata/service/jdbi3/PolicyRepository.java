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

package org.openmetadata.service.jdbi3;

import static java.lang.Boolean.FALSE;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.service.Entity.ALL_RESOURCES;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.security.policyevaluator.OperationContext.isEditOperation;
import static org.openmetadata.service.security.policyevaluator.OperationContext.isViewOperation;
import static org.openmetadata.service.util.EntityUtil.getRuleField;
import static org.openmetadata.service.util.EntityUtil.ruleMatch;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.policies.PolicyResource;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class PolicyRepository extends EntityRepository<Policy> {
  public static final String ENABLED = "enabled";

  public PolicyRepository() {
    super(
        PolicyResource.COLLECTION_PATH,
        POLICY,
        Policy.class,
        Entity.getCollectionDAO().policyDAO(),
        "",
        "");
  }

  @Override
  public void setFields(Policy policy, Fields fields) {
    policy.setTeams(fields.contains("teams") ? getTeams(policy) : policy.getTeams());
    policy.withRoles(fields.contains("roles") ? getRoles(policy) : policy.getRoles());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Policy> policies) {
    if (policies == null || policies.isEmpty()) {
      return;
    }

    if (fields.contains("teams")) {
      fetchAndSetTeams(policies);
    }

    if (fields.contains("roles")) {
      fetchAndSetRoles(policies);
    }

    // Handle standard fields that are managed by the parent class
    super.setFieldsInBulk(fields, policies);
  }

  private void fetchAndSetTeams(List<Policy> policies) {
    List<String> policyIds =
        policies.stream().map(Policy::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch teams
    List<CollectionDAO.EntityRelationshipObject> teamRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(policyIds, Relationship.HAS.ordinal(), POLICY, Entity.TEAM);

    // Create a map of policy ID to team references
    Map<UUID, List<EntityReference>> policyToTeams = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : teamRecords) {
      UUID policyId = UUID.fromString(record.getFromId());
      EntityReference teamRef =
          Entity.getEntityReferenceById(
              Entity.TEAM, UUID.fromString(record.getToId()), Include.ALL);
      policyToTeams.computeIfAbsent(policyId, k -> new ArrayList<>()).add(teamRef);
    }

    // Set teams on policies
    for (Policy policy : policies) {
      List<EntityReference> teams = policyToTeams.get(policy.getId());
      policy.setTeams(teams != null ? teams : new ArrayList<>());
    }
  }

  private void fetchAndSetRoles(List<Policy> policies) {
    List<String> policyIds =
        policies.stream().map(Policy::getId).map(UUID::toString).distinct().toList();

    // Bulk fetch roles
    List<CollectionDAO.EntityRelationshipObject> roleRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(policyIds, Relationship.HAS.ordinal(), POLICY, Entity.ROLE);

    // Create a map of policy ID to role references
    Map<UUID, List<EntityReference>> policyToRoles = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : roleRecords) {
      UUID policyId = UUID.fromString(record.getFromId());
      EntityReference roleRef =
          Entity.getEntityReferenceById(
              Entity.ROLE, UUID.fromString(record.getToId()), Include.ALL);
      policyToRoles.computeIfAbsent(policyId, k -> new ArrayList<>()).add(roleRef);
    }

    // Set roles on policies
    for (Policy policy : policies) {
      List<EntityReference> roles = policyToRoles.get(policy.getId());
      policy.setRoles(roles != null ? roles : new ArrayList<>());
    }
  }

  @Override
  public void clearFields(Policy policy, Fields fields) {
    policy.setTeams(fields.contains("teams") ? policy.getTeams() : null);
    policy.withRoles(fields.contains("roles") ? policy.getRoles() : null);
  }

  /* Get all the teams that use this policy */
  private List<EntityReference> getTeams(Policy policy) {
    return findFrom(policy.getId(), POLICY, Relationship.HAS, Entity.TEAM);
  }

  /* Get all the roles that use this policy */
  private List<EntityReference> getRoles(Policy policy) {
    return findFrom(policy.getId(), POLICY, Relationship.HAS, Entity.ROLE);
  }

  @Override
  public void prepare(Policy policy, boolean update) {
    validateRules(policy);
  }

  @Override
  public void storeEntity(Policy policy, boolean update) {
    store(policy, update);
  }

  @Override
  public void storeRelationships(Policy policy) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityRepository<Policy>.EntityUpdater getUpdater(
      Policy original, Policy updated, Operation operation, ChangeSource changeSource) {
    return new PolicyUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Policy entity, String updateBy) {
    if (FALSE.equals(entity.getAllowDelete())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(entity.getName(), Entity.POLICY));
    }
  }

  public void validateRules(Policy policy) {
    List<Rule> rules = policy.getRules();
    if (nullOrEmpty(rules)) {
      throw new IllegalArgumentException(CatalogExceptionMessage.EMPTY_RULES_IN_POLICY);
    }

    // Validate all the expressions in the rule
    for (Rule rule : rules) {
      CompiledRule.validateExpression(rule.getCondition(), Boolean.class);
      rule.getResources().sort(String.CASE_INSENSITIVE_ORDER);
      rule.getOperations().sort(Comparator.comparing(MetadataOperation::value));

      // Remove redundant resources
      rule.setResources(filterRedundantResources(rule.getResources()));

      // Remove redundant operations
      rule.setOperations(filterRedundantOperations(rule.getOperations()));
    }
    rules.sort(Comparator.comparing(Rule::getName));
  }

  public static List<String> filterRedundantResources(List<String> resources) {
    // If ALL_RESOURCES are in the resource list, remove redundant resources specifically mentioned
    boolean containsAllResources = resources.stream().anyMatch(ALL_RESOURCES::equalsIgnoreCase);
    return containsAllResources
        ? new ArrayList<>(List.of(ALL_RESOURCES))
        : new ArrayList<>(resources);
  }

  public static List<MetadataOperation> filterRedundantOperations(
      List<MetadataOperation> operations) {
    // If VIEW_ALL is in the operation list, remove all the other specific view operations that are
    // redundant
    boolean containsViewAll = operations.stream().anyMatch(o -> o.equals(VIEW_ALL));
    if (containsViewAll) {
      operations =
          operations.stream().filter(o -> o.equals(VIEW_ALL) || !isViewOperation(o)).toList();
    }

    // If EDIT_ALL is in the operation list, remove all the other specific edit operations that are
    // redundant
    boolean containsEditAll = operations.stream().anyMatch(o -> o.equals(EDIT_ALL));
    if (containsEditAll) {
      operations =
          operations.stream().filter(o -> o.equals(EDIT_ALL) || !isEditOperation(o)).toList();
    }
    return new ArrayList<>(operations);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PolicyUpdater extends EntityUpdater {
    public PolicyUpdater(Policy original, Policy updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange(ENABLED, original.getEnabled(), updated.getEnabled());
      updateRules(original.getRules(), updated.getRules());
    }

    private void updateRules(List<Rule> origRules, List<Rule> updatedRules) {
      // Check if the Rules have unique names
      if (!nullOrEmpty(updatedRules)) {
        Set<String> ruleNames =
            updatedRules.stream().map(Rule::getName).collect(Collectors.toSet());

        if (ruleNames.size() != updatedRules.size()) {
          throw new BadRequestException(
              "Policy contains duplicate Rules. Please use unique name for Rules.");
        }
      }

      // Record change description
      List<Rule> deletedRules = new ArrayList<>();
      List<Rule> addedRules = new ArrayList<>();

      recordListChange("rules", origRules, updatedRules, addedRules, deletedRules, ruleMatch);

      // Record changes based on updatedRule
      for (Rule updated : updatedRules) {
        Rule stored =
            origRules.stream().filter(c -> ruleMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New Rule added
          continue;
        }

        updateRuleDescription(stored, updated);
        updateRuleEffect(stored, updated);
        updateRuleOperations(stored, updated);
        updateRuleResources(stored, updated);
        updateRuleCondition(stored, updated);
      }
    }

    private void updateRuleDescription(Rule stored, Rule updated) {
      String ruleField = getRuleField(stored, FIELD_DESCRIPTION);
      recordChange(ruleField, stored.getDescription(), updated.getDescription());
    }

    private void updateRuleEffect(Rule stored, Rule updated) {
      String ruleField = getRuleField(stored, "effect");
      recordChange(ruleField, stored.getEffect(), updated.getEffect());
    }

    private void updateRuleOperations(Rule stored, Rule updated) {
      String ruleField = getRuleField(stored, "operations");
      recordChange(ruleField, stored.getOperations(), updated.getOperations());
    }

    private void updateRuleResources(Rule stored, Rule updated) {
      String ruleField = getRuleField(stored, "resources");
      recordChange(ruleField, stored.getResources(), updated.getResources());
    }

    private void updateRuleCondition(Rule stored, Rule updated) {
      String ruleField = getRuleField(stored, "condition");
      recordChange(ruleField, stored.getCondition(), updated.getCondition());
    }
  }
}
