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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.ONBOARDING_PLAYBOOK;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingConfigurationValidator;
import org.openmetadata.service.resources.governance.OnboardingPlaybookResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * One playbook per asset type. Creation-time enforcement therefore has exactly one answer - variation
 * inside an asset type is expressed as conditions on individual checks, not as competing playbooks.
 */
@Slf4j
@Repository
public class OnboardingPlaybookRepository extends EntityRepository<OnboardingPlaybook> {
  private static final String UPDATE_FIELDS = "owners,entityType,onboarding,intakeForm";

  public OnboardingPlaybookRepository() {
    super(
        OnboardingPlaybookResource.COLLECTION_PATH,
        ONBOARDING_PLAYBOOK,
        OnboardingPlaybook.class,
        Entity.getCollectionDAO().onboardingPlaybookDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = false;
  }

  @Override
  public void setFields(OnboardingPlaybook entity, Fields fields, RelationIncludes includes) {
    // Stages and gates are stored inline on the JSON document; nothing to resolve.
  }

  @Override
  public void clearFields(OnboardingPlaybook entity, Fields fields) {
    // No sparse fields.
  }

  @Override
  public void prepare(OnboardingPlaybook entity, boolean update) {
    if (entity.getEntityType() == null) {
      throw new IllegalArgumentException("OnboardingPlaybook requires entityType");
    }
    OnboardingConfigurationValidator.validate(entity);
    ensureUniquePerEntityType(entity);
  }

  @Override
  public void storeEntity(OnboardingPlaybook entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(OnboardingPlaybook entity) {
    // No cross-entity relationships.
  }

  @Override
  protected boolean shouldCleanupFqnDependents() {
    return false;
  }

  /**
   * The enabled playbook for an asset type, or null when none is configured or it is disabled.
   * Storage and deserialization errors propagate: silently returning null would let writes bypass
   * creation-time enforcement during a transient outage.
   */
  public OnboardingPlaybook findEnabledForEntityType(String entityType) {
    if (entityType == null) return null;
    String json = Entity.getCollectionDAO().onboardingPlaybookDAO().findByEntityType(entityType);
    if (json == null) return null;
    OnboardingPlaybook playbook = JsonUtils.readValue(json, OnboardingPlaybook.class);
    boolean enabled =
        playbook.getOnboarding() != null
            && Boolean.TRUE.equals(playbook.getOnboarding().getEnabled());
    return enabled ? playbook : null;
  }

  @Override
  public EntityRepository<OnboardingPlaybook>.EntityUpdater getUpdater(
      OnboardingPlaybook original,
      OnboardingPlaybook updated,
      Operation operation,
      ChangeSource changeSource) {
    return new OnboardingPlaybookUpdater(original, updated, operation);
  }

  /**
   * Without this, a republish that only changes the lifecycle is treated as a no-op: the version is
   * not bumped and the new gates are never written.
   */
  public class OnboardingPlaybookUpdater extends EntityUpdater {
    public OnboardingPlaybookUpdater(
        OnboardingPlaybook original, OnboardingPlaybook updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("entityType", original.getEntityType(), updated.getEntityType());
      recordChange("onboarding", original.getOnboarding(), updated.getOnboarding());
      recordChange("intakeForm", original.getIntakeForm(), updated.getIntakeForm());
    }
  }

  private void ensureUniquePerEntityType(OnboardingPlaybook entity) {
    String json =
        Entity.getCollectionDAO()
            .onboardingPlaybookDAO()
            .findByEntityType(entity.getEntityType().value());
    if (json == null) return;
    OnboardingPlaybook existing = JsonUtils.readValue(json, OnboardingPlaybook.class);
    // Compare by name first: on PUT (createOrUpdate) the incoming entity carries a freshly minted
    // UUID, so an id comparison would reject every republish of the same playbook.
    if (entity.getName() != null && entity.getName().equals(existing.getName())) return;
    if (entity.getId() != null && entity.getId().equals(existing.getId())) return;
    throw new IllegalArgumentException(
        String.format(
            "An onboarding playbook already exists for entityType '%s' (name: %s). Only one "
                + "playbook per asset type is allowed.",
            entity.getEntityType().value(), existing.getName()));
  }
}
