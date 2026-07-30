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

import static org.openmetadata.service.Entity.INTAKE_FORM;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.IntakeFormResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class IntakeFormRepository extends EntityRepository<IntakeForm> {
  private static final String UPDATE_FIELDS = "owners,requiredFields,enabled,entityType";

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
    // No inherited or lazy fields — all state lives on the entity JSON
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
    ensureUniquePerEntityType(entity, update);
  }

  @Override
  public void storeEntity(IntakeForm entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(IntakeForm entity) {
    // No cross-entity relationships for IntakeForm
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
    if (Boolean.FALSE.equals(form.getEnabled())) {
      return null;
    }
    return form;
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
      recordChange("requiredFields", original.getRequiredFields(), updated.getRequiredFields());
    }
  }
}
