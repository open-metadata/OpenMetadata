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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class PipelineServiceRepository extends EntityRepository<PipelineService> {
  private static final String UPDATE_FIELDS = "owner";

  public PipelineServiceRepository(CollectionDAO dao) {
    super(
        PipelineServiceResource.COLLECTION_PATH,
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        dao.pipelineServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
  }

  @Override
  public PipelineService setFields(PipelineService entity, Fields fields) throws IOException {
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(PipelineService entity) throws IOException {
    setFullyQualifiedName(entity);
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
    EntityUtil.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void storeEntity(PipelineService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(PipelineService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(PipelineService original, PipelineService updated, Operation operation) {
    return new PipelineServiceUpdater(original, updated, operation);
  }

  public class PipelineServiceUpdater extends EntityUpdater {
    public PipelineServiceUpdater(PipelineService original, PipelineService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("pipelineUrl", original.getPipelineUrl(), updated.getPipelineUrl());
      recordChange("ingestionSchedule", original.getIngestionSchedule(), updated.getIngestionSchedule(), true);
    }
  }
}
