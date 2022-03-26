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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.entityReferenceMatch;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class PolicyRepository extends EntityRepository<Policy> {
  private static final String POLICY_UPDATE_FIELDS = "owner,location";
  private static final String POLICY_PATCH_FIELDS = "owner,location";
  public static final String ENABLED = "enabled";

  private final PolicyEvaluator policyEvaluator;

  public PolicyRepository(CollectionDAO dao) {
    super(
        PolicyResource.COLLECTION_PATH,
        Entity.POLICY,
        Policy.class,
        dao.policyDAO(),
        dao,
        POLICY_PATCH_FIELDS,
        POLICY_UPDATE_FIELDS);
    policyEvaluator = PolicyEvaluator.getInstance();
  }

  public static String getFQN(Policy policy) {
    return policy.getName();
  }

  @Transaction
  public EntityReference getOwnerReference(Policy policy) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), policy.getOwner());
  }

  /** Find the location to which this policy applies to. * */
  @Transaction
  private EntityReference getLocationForPolicy(Policy policy) throws IOException {
    List<String> result = findTo(policy.getId(), Entity.POLICY, Relationship.APPLIED_TO, Entity.LOCATION);
    // There is at most one location for a policy.
    return result.size() == 1
        ? daoCollection.locationDAO().findEntityReferenceById(UUID.fromString(result.get(0)))
        : null;
  }

  @Override
  public Policy setFields(Policy policy, Fields fields) throws IOException, ParseException {
    policy.setOwner(fields.contains(FIELD_OWNER) ? getOwner(policy) : null);
    policy.setLocation(fields.contains("location") ? getLocationForPolicy(policy) : null);
    return policy;
  }

  @Override
  public EntityInterface<Policy> getEntityInterface(Policy entity) {
    return new PolicyEntityInterface(entity);
  }

  /** Generate EntityReference for a given Policy's Location. * */
  @Transaction
  private EntityReference getLocationReference(Policy policy) throws IOException {
    if (policy == null || policy.getLocation() == null || policy.getLocation().getId() == null) {
      return null;
    }

    Location location = daoCollection.locationDAO().findEntityById(policy.getLocation().getId());
    if (location == null) {
      return null;
    }
    return new LocationRepository.LocationEntityInterface(location).getEntityReference();
  }

  @Override
  public void prepare(Policy policy) throws IOException {
    isValid(policy);
    policy.setFullyQualifiedName(getFQN(policy));
    policy.setLocation(getLocationReference(policy));
    // Check if owner is valid and set the relationship
    policy.setOwner(EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), policy.getOwner()));
  }

  @Override
  public void storeEntity(Policy policy, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = policy.getOwner();
    EntityReference location = policy.getLocation();
    URI href = policy.getHref();

    if (policy.getFullyQualifiedName() == null) {
      policy.setFullyQualifiedName(getFQN(policy));
    }

    // Don't store owner, location and href as JSON. Build it on the fly based on relationships
    policy.withOwner(null).withLocation(null).withHref(null);

    store(policy.getId(), policy, update);
    if (PolicyType.AccessControl.equals(policy.getPolicyType())) {
      // Refresh rules in PolicyEvaluator right after an Access Control policy has been stored.
      policyEvaluator.refreshRules();
    }

    // Restore the relationships
    policy.withOwner(owner).withLocation(location).withHref(href);
  }

  @Override
  public void storeRelationships(Policy policy) {
    // Add policy owner relationship.
    setOwner(policy, policy.getOwner());
    // Add location to which policy is assigned to.
    setLocation(policy, policy.getLocation());
  }

  @Override
  public EntityUpdater getUpdater(Policy original, Policy updated, Operation operation) {
    return new PolicyUpdater(original, updated, operation);
  }

  /**
   * Validates policy schema beyond what json-schema validation supports. If policy is invalid, throws {@link
   * IllegalArgumentException}
   *
   * <p>Example of validation that jsonschema2pojo does not support: <code>
   *  "anyOf": [
   *     {"required": ["entityTypeAttr"]},
   *     {"required": ["entityTagAttr"]},
   *     {"required": ["userRoleAttr"]}
   *   ]
   * </code>
   */
  public void isValid(Policy policy) throws IOException {
    if (!policy.getPolicyType().equals(PolicyType.AccessControl)) {
      return;
    }
    LOG.debug("Validating rules for {} policy: {}", PolicyType.AccessControl, policy.getName());

    Set<MetadataOperation> operations = new HashSet<>();
    for (Object ruleObject : policy.getRules()) {
      // Cast to access control policy Rule.
      Rule rule = JsonUtils.readValue(JsonUtils.getJsonStructure(ruleObject).toString(), Rule.class);

      if (rule.getOperation() == null) {
        throw new IllegalArgumentException(
            String.format(
                "Found invalid rule %s within policy %s. Please ensure operation is non-null",
                rule.getName(), policy.getName()));
      }

      if (!operations.add(rule.getOperation())) {
        throw new IllegalArgumentException(
            String.format(
                "Found multiple rules with operation %s within policy %s. Please ensure that operation across all rules within the policy are distinct",
                rule.getOperation(), policy.getName()));
      }

      // If all user (subject) and entity (object) attributes are null, the rule is invalid.
      if (rule.getEntityTagAttr() == null && rule.getEntityTypeAttr() == null && rule.getUserRoleAttr() == null) {
        throw new IllegalArgumentException(
            String.format(
                "Found invalid rule %s within policy %s. Please ensure that at least one among the user (subject) and entity (object) attributes is specified",
                rule.getName(), policy.getName()));
      }
    }
    // No validation errors, if execution reaches here.
  }

  private List<Policy> getAccessControlPolicies() throws IOException, ParseException {
    EntityUtil.Fields fields = new EntityUtil.Fields(List.of("policyType", "rules", ENABLED));
    ListFilter filter = new ListFilter();
    List<String> jsons = daoCollection.policyDAO().listAfter(filter, Integer.MAX_VALUE, "");
    List<Policy> policies = new ArrayList<>(jsons.size());
    for (String json : jsons) {
      Policy policy = setFields(JsonUtils.readValue(json, Policy.class), fields);
      if (!policy.getPolicyType().equals(PolicyType.AccessControl)) {
        continue;
      }
      policies.add(policy);
    }
    return policies;
  }

  /**
   * Helper method to get Access Control Policies Rules. This method returns only rules for policies that are enabled.
   */
  @SneakyThrows(ParseException.class)
  public List<Rule> getAccessControlPolicyRules() throws IOException {
    List<Policy> policies = getAccessControlPolicies();
    List<Rule> rules = new ArrayList<>();
    for (Policy policy : policies) {
      if (!Boolean.TRUE.equals(policy.getEnabled())) {
        // Skip if policy is not enabled.
        continue;
      }
      List<Object> ruleObjects = policy.getRules();
      for (Object ruleObject : ruleObjects) {
        Rule rule = JsonUtils.readValue(JsonUtils.getJsonStructure(ruleObject).toString(), Rule.class);
        rules.add(rule);
      }
    }
    return rules;
  }

  private void setLocation(Policy policy, EntityReference location) {
    if (location == null || location.getId() == null) {
      return;
    }
    addRelationship(
        policy.getId(), policy.getLocation().getId(), Entity.POLICY, Entity.LOCATION, Relationship.APPLIED_TO);
  }

  public static class PolicyEntityInterface extends EntityInterface<Policy> {
    public PolicyEntityInterface(Policy entity) {
      super(Entity.POLICY, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName() != null ? entity.getFullyQualifiedName() : PolicyRepository.getFQN(entity);
    }

    public List<Object> getRules() {
      return entity.getRules();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public Policy getEntity() {
      return entity;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    public void setRules(List<Object> rules) {
      entity.setRules(rules);
    }

    @Override
    public Policy withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PolicyUpdater extends EntityUpdater {
    public PolicyUpdater(Policy original, Policy updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Disallow changing policyType.
      if (original.getEntity().getPolicyType() != updated.getEntity().getPolicyType()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.POLICY, "policyType"));
      }
      recordChange("policyUrl", original.getEntity().getPolicyUrl(), updated.getEntity().getPolicyUrl());
      recordChange(ENABLED, original.getEntity().getEnabled(), updated.getEntity().getEnabled());
      recordChange("rules", original.getEntity().getRules(), updated.getEntity().getRules());
      updateLocation(original.getEntity(), updated.getEntity());
    }

    private void updateLocation(Policy origPolicy, Policy updatedPolicy) throws IOException {
      // remove original Policy --> Location relationship if exists.
      if (origPolicy.getLocation() != null && origPolicy.getLocation().getId() != null) {
        daoCollection
            .relationshipDAO()
            .delete(
                origPolicy.getId().toString(),
                Entity.POLICY,
                origPolicy.getLocation().getId().toString(),
                Entity.LOCATION,
                Relationship.APPLIED_TO.ordinal());
      }
      // insert updated Policy --> Location relationship.
      if (updatedPolicy.getLocation() != null && updatedPolicy.getLocation().getId() != null) {
        addRelationship(
            updatedPolicy.getId(),
            updatedPolicy.getLocation().getId(),
            Entity.POLICY,
            Entity.LOCATION,
            Relationship.APPLIED_TO);
      }
      recordChange("location", origPolicy.getLocation(), updatedPolicy.getLocation(), true, entityReferenceMatch);
    }
  }
}
