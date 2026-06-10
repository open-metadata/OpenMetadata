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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Regression for the Context Center 404 bug. When a Knowledge Page / Memory linked a column as a
 * related entity, the {@code entity_relationship} table held a row with
 * {@code fromEntity="tableColumn"} and {@code relation=HAS}. The bulk relationship loader's HAS
 * query (run when the LIST endpoint asks for domains/dataProducts) returned that row and called
 * {@code Entity.getEntityReferencesByIds("tableColumn", …)}, which has no registered
 * {@link EntityRepository} — surfacing as a 404 to the client.
 */
class EntityRepositoryBulkFieldsTest {

  private CollectionDAO daoCollection;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  private static class DomainAwarePipelineRepo extends EntityRepository<Pipeline> {
    DomainAwarePipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "domains", "domains");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(daoCollection);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void resolveRelationshipEntityReferencesByType_skipsUnregisteredEntityType() {
    DomainAwarePipelineRepo repo = new DomainAwarePipelineRepo(pipelineDAO);

    UUID pipelineId = UUID.randomUUID();
    Pipeline entity =
        new Pipeline().withId(pipelineId).withName("p").withFullyQualifiedName("svc.p");

    UUID domainId = UUID.randomUUID();
    EntityRelationshipObject domainRecord =
        EntityRelationshipObject.builder()
            .fromId(domainId.toString())
            .toId(pipelineId.toString())
            .fromEntity(Entity.DOMAIN)
            .toEntity(Entity.PIPELINE)
            .relation(Relationship.HAS.ordinal())
            .build();
    EntityRelationshipObject columnRecord =
        EntityRelationshipObject.builder()
            .fromId(UUID.randomUUID().toString())
            .toId(pipelineId.toString())
            .fromEntity(Entity.TABLE_COLUMN)
            .toEntity(Entity.PIPELINE)
            .relation(Relationship.HAS.ordinal())
            .build();

    when(relationshipDAO.findFromBatchWithRelations(
            anyList(), eq(Entity.PIPELINE), anyList(), eq(Include.ALL)))
        .thenReturn(List.of(domainRecord, columnRecord));

    EntityReference domainRef =
        new EntityReference().withId(domainId).withType(Entity.DOMAIN).withName("sales");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(() -> Entity.hasEntityRepository(Entity.DOMAIN)).thenReturn(true);
      entityMock.when(() -> Entity.hasEntityRepository(Entity.TABLE_COLUMN)).thenReturn(false);
      entityMock
          .when(() -> Entity.getEntityReferencesByIds(eq(Entity.DOMAIN), anyList(), any()))
          .thenReturn(List.of(domainRef));

      assertDoesNotThrow(
          () -> repo.setFieldsInBulk(new Fields(Set.of(Entity.FIELD_DOMAINS)), List.of(entity)));

      entityMock.verify(
          () -> Entity.getEntityReferencesByIds(eq(Entity.TABLE_COLUMN), anyList(), any()),
          never());
    }

    assertNotNull(entity.getDomains());
    assertEquals(1, entity.getDomains().size());
    assertEquals(domainId, entity.getDomains().get(0).getId());
  }
}
