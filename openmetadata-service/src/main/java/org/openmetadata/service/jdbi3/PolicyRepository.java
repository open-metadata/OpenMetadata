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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.LOCATION;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.getRuleField;
import static org.openmetadata.service.util.EntityUtil.ruleMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Location;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.policies.PolicyResource;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.PolicyCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class PolicyRepository extends EntityRepository<Policy> {
  private static final String POLICY_UPDATE_FIELDS = "owner,location";
  private static final String POLICY_PATCH_FIELDS = "owner,location";
  public static final String ENABLED = "enabled";

  public PolicyRepository(CollectionDAO dao) {
    super(
        PolicyResource.COLLECTION_PATH,
        POLICY,
        Policy.class,
        dao.policyDAO(),
        dao,
        POLICY_PATCH_FIELDS,
        POLICY_UPDATE_FIELDS);
  }

  /** Find the location to which this policy applies to. * */
  @Transaction
  private EntityReference getLocationForPolicy(Policy policy) throws IOException {
    return getToEntityRef(policy.getId(), Relationship.APPLIED_TO, LOCATION, false);
  }

  @Override
  public Policy setFields(Policy policy, Fields fields) throws IOException {
    policy.setLocation(fields.contains("location") ? getLocationForPolicy(policy) : null);
    policy.setTeams(fields.contains("teams") ? getTeams(policy) : null);
    return policy.withRoles(fields.contains("roles") ? getRoles(policy) : null);
  }

  /* Get all the teams that use this policy */
  private List<EntityReference> getTeams(Policy policy) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(policy.getId(), POLICY, Relationship.HAS, Entity.TEAM);
    return EntityUtil.populateEntityReferences(records, Entity.TEAM);
  }

  /* Get all the roles that use this policy */
  private List<EntityReference> getRoles(Policy policy) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(policy.getId(), POLICY, Relationship.HAS, Entity.ROLE);
    return EntityUtil.populateEntityReferences(records, Entity.ROLE);
  }

  /** Generate EntityReference for a given Policy's Location. * */
  @Transaction
  private EntityReference getLocationReference(Policy policy) throws IOException {
    if (policy == null || getId(policy.getLocation()) == null) {
      return null;
    }

    Location location = daoCollection.locationDAO().findEntityById(policy.getLocation().getId());
    if (location == null) {
      return null;
    }
    return location.getEntityReference();
  }

  @Override
  public void prepare(Policy policy) throws IOException {
    validateRules(policy);
    policy.setLocation(getLocationReference(policy));
  }

  @Override
  public void storeEntity(Policy policy, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = policy.getOwner();
    EntityReference location = policy.getLocation();
    URI href = policy.getHref();

    // Don't store owner, location and href as JSON. Build it on the fly based on relationships
    policy.withOwner(null).withLocation(null).withHref(null);

    store(policy, update);

    // Restore the relationships
    if (update) {
      PolicyCache.getInstance().invalidatePolicy(policy.getId());
    }
    policy.withOwner(owner).withLocation(location).withHref(href);
  }

  @Override
  public void storeRelationships(Policy policy) {
    // Add policy owner relationship.
    storeOwner(policy, policy.getOwner());
    // Add location to which policy is assigned to.
    setLocation(policy, policy.getLocation());
  }

  @Override
  public PolicyUpdater getUpdater(Policy original, Policy updated, Operation operation) {
    return new PolicyUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Policy entity) {
    if (FALSE.equals(entity.getAllowDelete())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(entity.getName(), Entity.POLICY));
    }
  }

  @Override
  protected void cleanup(Policy policy) throws IOException {
    super.cleanup(policy);
    PolicyCache.getInstance().invalidatePolicy(policy.getId());
  }

  public void validateRules(Policy policy) {
    // Resolve JSON blobs into Rule object and perform schema based validation
    List<Rule> rules = policy.getRules();
    if (listOrEmpty(rules).isEmpty()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.EMPTY_RULES_IN_POLICY);
    }

    // Validate all the expressions in the rule
    for (Rule rule : rules) {
      CompiledRule.validateExpression(rule.getCondition(), Boolean.class);
      rule.getResources().sort(String.CASE_INSENSITIVE_ORDER);
      rule.getOperations().sort(Comparator.comparing(MetadataOperation::value));
    }
    rules.sort(Comparator.comparing(Rule::getName));
  }

  private void setLocation(Policy policy, EntityReference location) {
    if (getId(location) == null) {
      return;
    }
    addRelationship(policy.getId(), policy.getLocation().getId(), POLICY, Entity.LOCATION, Relationship.APPLIED_TO);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PolicyUpdater extends EntityUpdater {
    public PolicyUpdater(Policy original, Policy updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange(ENABLED, original.getEnabled(), updated.getEnabled());
      updateLocation(original, updated);
      updateRules(original.getRules(), updated.getRules());
    }

    private void updateLocation(Policy origPolicy, Policy updatedPolicy) throws IOException {
      // remove original Policy --> Location relationship if exists.
      if (getId(origPolicy.getLocation()) != null) {
        deleteRelationship(
            origPolicy.getId(), POLICY, origPolicy.getLocation().getId(), Entity.LOCATION, Relationship.APPLIED_TO);
      }
      // insert updated Policy --> Location relationship.
      if (getId(updatedPolicy.getLocation()) != null) {
        addRelationship(
            updatedPolicy.getId(),
            updatedPolicy.getLocation().getId(),
            POLICY,
            Entity.LOCATION,
            Relationship.APPLIED_TO);
      }
      recordChange("location", origPolicy.getLocation(), updatedPolicy.getLocation(), true, entityReferenceMatch);
    }

    private void updateRules(List<Rule> origRules, List<Rule> updatedRules) throws IOException {
      // Record change description
      List<Rule> deletedRules = new ArrayList<>();
      List<Rule> addedRules = new ArrayList<>();

      recordListChange("rules", origRules, updatedRules, addedRules, deletedRules, ruleMatch);

      // Record changes based on updatedRule
      for (Rule updated : updatedRules) {
        Rule stored = origRules.stream().filter(c -> ruleMatch.test(c, updated)).findAny().orElse(null);
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

    private void updateRuleDescription(Rule stored, Rule updated) throws JsonProcessingException {
      String ruleField = getRuleField(stored, FIELD_DESCRIPTION);
      recordChange(ruleField, stored.getDescription(), updated.getDescription());
    }

    private void updateRuleEffect(Rule stored, Rule updated) throws JsonProcessingException {
      String ruleField = getRuleField(stored, "effect");
      recordChange(ruleField, stored.getEffect(), updated.getEffect());
    }

    private void updateRuleOperations(Rule stored, Rule updated) throws JsonProcessingException {
      String ruleField = getRuleField(stored, "operations");
      recordChange(ruleField, stored.getOperations(), updated.getOperations());
    }

    private void updateRuleResources(Rule stored, Rule updated) throws JsonProcessingException {
      String ruleField = getRuleField(stored, "resources");
      recordChange(ruleField, stored.getResources(), updated.getResources());
    }

    private void updateRuleCondition(Rule stored, Rule updated) throws JsonProcessingException {
      String ruleField = getRuleField(stored, "condition");
      recordChange(ruleField, stored.getCondition(), updated.getCondition());
    }
  }
}
