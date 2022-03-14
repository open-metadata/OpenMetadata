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

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.resources.operations.AirflowPipelineResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class AirflowPipelineRepository extends EntityRepository<AirflowPipeline> {
  private static final Fields AIRFLOW_PIPELINE_UPDATE_FIELDS =
      new Fields(AirflowPipelineResource.ALLOWED_FIELDS, FIELD_OWNER);
  private static final Fields AIRFLOW_PIPELINE_PATCH_FIELDS =
      new Fields(AirflowPipelineResource.ALLOWED_FIELDS, FIELD_OWNER);

  public AirflowPipelineRepository(CollectionDAO dao) {
    super(
        AirflowPipelineResource.COLLECTION_PATH,
        Entity.AIRFLOW_PIPELINE,
        AirflowPipeline.class,
        dao.airflowPipelineDAO(),
        dao,
        AIRFLOW_PIPELINE_PATCH_FIELDS,
        AIRFLOW_PIPELINE_UPDATE_FIELDS,
        false,
        true,
        false);
  }

  public static String getFQN(AirflowPipeline airflowPipeline) {
    return (airflowPipeline != null && airflowPipeline.getService() != null)
        ? (airflowPipeline.getService().getName() + "." + airflowPipeline.getName())
        : null;
  }

  @Transaction
  public EntityReference getOwnerReference(AirflowPipeline airflowPipeline) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), airflowPipeline.getOwner());
  }

  @Override
  public AirflowPipeline setFields(AirflowPipeline airflowPipeline, Fields fields) throws IOException, ParseException {
    airflowPipeline.setService(getService(airflowPipeline));
    airflowPipeline.setOwner(fields.contains(FIELD_OWNER) ? getOwner(airflowPipeline) : null);
    return airflowPipeline;
  }

  @Override
  public EntityInterface<AirflowPipeline> getEntityInterface(AirflowPipeline entity) {
    return new AirflowPipelineEntityInterface(entity);
  }

  @Override
  public void prepare(AirflowPipeline airflowPipeline) throws IOException, ParseException {
    EntityUtil.escapeReservedChars(getEntityInterface(airflowPipeline));
    EntityReference entityReference = Entity.getEntityReference(airflowPipeline.getService());
    airflowPipeline.setService(entityReference);
    airflowPipeline.setFullyQualifiedName(getFQN(airflowPipeline));
    airflowPipeline.setOwner(Entity.getEntityReference(airflowPipeline.getOwner()));
  }

  @Override
  public void storeEntity(AirflowPipeline airflowPipeline, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = airflowPipeline.getOwner();
    EntityReference service = airflowPipeline.getService();

    // Don't store owner. Build it on the fly based on relationships
    airflowPipeline.withOwner(null).withService(null).withHref(null);

    store(airflowPipeline.getId(), airflowPipeline, update);

    // Restore the relationships
    airflowPipeline.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(AirflowPipeline airflowPipeline) {
    EntityReference service = airflowPipeline.getService();
    addRelationship(
        service.getId(), airflowPipeline.getId(), service.getType(), Entity.AIRFLOW_PIPELINE, Relationship.CONTAINS);
    setOwner(airflowPipeline, airflowPipeline.getOwner());
    applyTags(airflowPipeline);
  }

  @Override
  public EntityUpdater getUpdater(AirflowPipeline original, AirflowPipeline updated, Operation operation) {
    return new AirflowPipelineUpdater(original, updated, operation);
  }

  private EntityReference getService(AirflowPipeline airflowPipeline) throws IOException {
    return getContainer(airflowPipeline.getId(), Entity.AIRFLOW_PIPELINE);
  }

  public static class AirflowPipelineEntityInterface implements EntityInterface<AirflowPipeline> {
    private final AirflowPipeline entity;

    public AirflowPipelineEntityInterface(AirflowPipeline entity) {
      this.entity = entity;
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
      return entity.getFullyQualifiedName() != null
          ? entity.getFullyQualifiedName()
          : AirflowPipelineRepository.getFQN(entity);
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
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.AIRFLOW_PIPELINE);
    }

    @Override
    public AirflowPipeline getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
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

    @Override
    public AirflowPipeline withHref(URI href) {
      return entity.withHref(href);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class AirflowPipelineUpdater extends EntityUpdater {
    public AirflowPipelineUpdater(AirflowPipeline original, AirflowPipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      AirflowPipeline origIngestion = original.getEntity();
      AirflowPipeline updatedIngestion = updated.getEntity();
      recordChange("scheduleInterval", origIngestion.getScheduleInterval(), updatedIngestion.getScheduleInterval());
      recordChange("pipelineConfig", origIngestion.getPipelineConfig(), updatedIngestion.getPipelineConfig());
      recordChange("startDate", origIngestion.getStartDate(), updatedIngestion.getStartDate());
      recordChange("endDate", origIngestion.getEndDate(), updatedIngestion.getEndDate());
    }
  }
}
