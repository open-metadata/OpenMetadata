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
import static org.openmetadata.catalog.Entity.LOCATION;
import static org.openmetadata.catalog.Entity.POLICY;
import static org.openmetadata.catalog.util.EntityUtil.entityReferenceMatch;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

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
    policy.setOwner(fields.contains(FIELD_OWNER) ? getOwner(policy) : null);
    policy.setLocation(fields.contains("location") ? getLocationForPolicy(policy) : null);
    return policy;
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
    return location.getEntityReference();
  }

  @Override
  public void prepare(Policy policy) throws IOException {
    setFullyQualifiedName(policy);
    isValid(policy);
    policy.setLocation(getLocationReference(policy));
    // Check if owner is valid and set the relationship
    populateOwner(policy.getOwner());
  }

  @Override
  public void storeEntity(Policy policy, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = policy.getOwner();
    EntityReference location = policy.getLocation();
    URI href = policy.getHref();

    // Don't store owner, location and href as JSON. Build it on the fly based on relationships
    policy.withOwner(null).withLocation(null).withHref(null);

    store(policy.getId(), policy, update);

    // Restore the relationships
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
    List<Rule> rules = EntityUtil.resolveRules(policy.getRules());
    for (Rule rule : rules) {
      if (rule.getOperation() == null) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.invalidPolicyOperationNull(rule.getName(), policy.getName()));
      }

      if (!operations.add(rule.getOperation())) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.invalidPolicyDuplicateOperation(rule.getOperation().value(), policy.getName()));
      }
    }
  }

  public List<Policy> getAccessControlPolicies() throws IOException {
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

  private void setLocation(Policy policy, EntityReference location) {
    if (location == null || location.getId() == null) {
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
      // Disallow changing policyType.
      if (original.getPolicyType() != updated.getPolicyType()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(POLICY, "policyType"));
      }
      recordChange("rules", original.getRules(), updated.getRules());
      updateLocation(original, updated);
    }

    private void updateLocation(Policy origPolicy, Policy updatedPolicy) throws IOException {
      // remove original Policy --> Location relationship if exists.
      if (origPolicy.getLocation() != null && origPolicy.getLocation().getId() != null) {
        daoCollection
            .relationshipDAO()
            .delete(
                origPolicy.getId().toString(),
                POLICY,
                origPolicy.getLocation().getId().toString(),
                Entity.LOCATION,
                Relationship.APPLIED_TO.ordinal());
      }
      // insert updated Policy --> Location relationship.
      if (updatedPolicy.getLocation() != null && updatedPolicy.getLocation().getId() != null) {
        addRelationship(
            updatedPolicy.getId(),
            updatedPolicy.getLocation().getId(),
            POLICY,
            Entity.LOCATION,
            Relationship.APPLIED_TO);
      }
      recordChange("location", origPolicy.getLocation(), updatedPolicy.getLocation(), true, entityReferenceMatch);
    }
  }
}
