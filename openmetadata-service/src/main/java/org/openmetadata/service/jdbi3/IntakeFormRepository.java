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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.INTAKE_FORM;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.IntakeFormResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.IntakeFormUtil;

@Slf4j
@Repository
public class IntakeFormRepository extends EntityRepository<IntakeForm> {
  private static final String UPDATE_FIELDS = "owners,formFields,requiredFields,enabled,entityType";

  public IntakeFormRepository() {
    super(
        IntakeFormResource.COLLECTION_PATH,
        INTAKE_FORM,
        IntakeForm.class,
        Entity.getCollectionDAO().intakeFormDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = false;
  }

  @Override
  public void setFields(IntakeForm entity, Fields fields, RelationIncludes relationIncludes) {
    IntakeFormUtil.synchronizeFields(entity);
  }

  @Override
  public void clearFields(IntakeForm entity, Fields fields) {
    // No fields to clear
  }

  @Override
  public void prepare(IntakeForm entity, boolean update) {
    if (entity.getEntityType() == null) {
      throw new IllegalArgumentException("IntakeForm requires entityType");
    }
    IntakeFormUtil.synchronizeFields(entity);
    ensureUniquePerEntityType(entity, update);
  }

  @Override
  public void storeEntity(IntakeForm entity, boolean update) {
    IntakeFormUtil.synchronizeFields(entity);
    store(entity, update);
  }

  @Override
  public void storeRelationships(IntakeForm entity) {
    // No cross-entity relationships for IntakeForm
  }

  @Override
  protected boolean shouldCleanupFqnDependents() {
    return false;
  }

  /**
   * Returns the enabled IntakeForm for a given entityType, or null if none is configured or the
   * configured form is disabled. Storage / deserialization errors propagate to the caller —
   * silently returning null here would let writes bypass intake-form validation during a
   * transient outage.
   */
  public IntakeForm findEnabledForEntityType(String entityType) {
    if (entityType == null) return null;
    String json = Entity.getCollectionDAO().intakeFormDAO().findByEntityType(entityType);
    if (json == null) return null;
    IntakeForm form = JsonUtils.readValue(json, IntakeForm.class);
    IntakeFormUtil.synchronizeFields(form);
    if (Boolean.FALSE.equals(form.getEnabled())) {
      return null;
    }
    return form;
  }

  /**
   * Drops a deleted custom property from this entityType's IntakeForm. Routed through the standard
   * EntityUpdater so the cascade increments the version and produces a changeDescription and change
   * event — storing directly would leave the version untouched, letting a client PUT a stale copy
   * past the optimistic-lock check.
   */
  public void removeCustomPropertyField(String entityType, String propertyName, String updatedBy) {
    String json = Entity.getCollectionDAO().intakeFormDAO().findByEntityType(entityType);
    if (!nullOrEmpty(json)) {
      IntakeForm original = JsonUtils.readValue(json, IntakeForm.class);
      IntakeFormUtil.synchronizeFields(original);
      IntakeForm updated = JsonUtils.deepCopy(original, IntakeForm.class);
      if (IntakeFormUtil.removeCustomPropertyField(updated, propertyName)) {
        updated.setUpdatedBy(updatedBy);
        getUpdater(original, updated, Operation.PATCH, null).update();
        // Change events are normally emitted by ChangeEventHandler, a REST
        // response filter. This cascade runs inside the Type update request, so
        // that filter only ever sees the Type — without this the IntakeForm
        // silently changes version with no event for subscribers to consume.
        createAndInsertChangeEvent(
            original, updated, updated.getChangeDescription(), ENTITY_UPDATED);
      }
    }
  }

  private void ensureUniquePerEntityType(IntakeForm entity, boolean update) {
    String existingJson =
        Entity.getCollectionDAO().intakeFormDAO().findByEntityType(entity.getEntityType().value());
    if (existingJson == null) return;
    IntakeForm existing = JsonUtils.readValue(existingJson, IntakeForm.class);
    // Same entity being updated — compare by name/FQN since ID may not be resolved yet
    // during PUT (createOrUpdate) where the incoming entity starts with a freshly minted UUID.
    if (entity.getName() != null && entity.getName().equals(existing.getName())) return;
    if (entity.getId() != null && entity.getId().equals(existing.getId())) return;
    throw new IllegalArgumentException(
        "An IntakeForm already exists for entityType '"
            + entity.getEntityType().value()
            + "' (name: "
            + existing.getName()
            + "). Only one IntakeForm per entityType is allowed.");
  }

  @Override
  public EntityRepository<IntakeForm>.EntityUpdater getUpdater(
      IntakeForm original, IntakeForm updated, Operation operation, ChangeSource changeSource) {
    return new IntakeFormUpdater(original, updated, operation);
  }

  public class IntakeFormUpdater extends EntityUpdater {
    public IntakeFormUpdater(IntakeForm original, IntakeForm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("entityType", original.getEntityType(), updated.getEntityType());
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("formFields", original.getFormFields(), updated.getFormFields());
      recordChange("requiredFields", original.getRequiredFields(), updated.getRequiredFields());
    }
  }
}
