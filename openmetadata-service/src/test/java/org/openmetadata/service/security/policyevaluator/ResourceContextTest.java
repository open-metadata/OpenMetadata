/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

class ResourceContextTest {

  /**
   * Bulk authorization: every {@link ResourceContext} in one request shares a single {@link
   * BulkFieldHydrator}, so the first policy that reads tags hydrates the whole batch in one query
   * and later reads are no-ops. Without this the on-demand path fetched tags once per entity (N+1).
   */
  @Test
  void bulkContexts_shareHydrator_tagsHydratedOncePerRequest() {
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.isSupportsTags()).thenReturn(true);

    int[] batchLoads = {0};
    BulkFieldHydrator hydrator =
        new BulkFieldHydrator(Map.of(Entity.FIELD_TAGS, () -> batchLoads[0]++));

    ResourceContext<Table> c1 = new ResourceContext<>("table", new Table(), repository, hydrator);
    ResourceContext<Table> c2 = new ResourceContext<>("table", new Table(), repository, hydrator);
    ResourceContext<Table> c3 = new ResourceContext<>("table", new Table(), repository, hydrator);

    c1.ensureTagsLoaded();
    c2.ensureTagsLoaded();
    c3.ensureTagsLoaded();

    assertEquals(
        1, batchLoads[0], "tags must be hydrated once for the whole bulk request, not per entity");
    verify(repository, never()).setFieldsInternal(any(), any(Fields.class));
  }

  /** Single-entity requests carry no loader and keep the per-entity on-demand tag fetch. */
  @Test
  void singleEntityContext_noLoader_fetchesTagsPerEntity() {
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.isSupportsTags()).thenReturn(true);
    Fields tagFields = mock(Fields.class);
    when(repository.getFields(anyString())).thenReturn(tagFields);

    Table table = new Table();
    ResourceContext<Table> context = new ResourceContext<>("table", table, repository);

    context.ensureTagsLoaded();

    verify(repository).setFieldsInternal(table, tagFields);
  }

  /** An asset outside a service hierarchy answers "no service" rather than failing. */
  @Test
  void serviceAttributes_absent_whenEntityHasNoService() {
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.getEntityType()).thenReturn(Entity.TABLE);

    ResourceContext<Table> context = new ResourceContext<>(Entity.TABLE, new Table(), repository);

    assertNull(context.getServiceReference());
    assertTrue(context.getServiceTags().isEmpty());
    assertNull(context.getServiceType());
  }

  /**
   * The service entity is read once and reused across every attribute a condition asks for. A rule
   * set with several service conditions evaluates each of them against every requested operation,
   * so an un-memoized read would multiply by both.
   */
  @Test
  void serviceAttributes_readTheServiceOnce_acrossRepeatedConditions() {
    DatabaseService service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("snowflake-sandbox")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withTags(List.of(new TagLabel().withTagFQN("Environment.Development")));
    DatabaseServiceRepository serviceRepository = registerDatabaseService(service);

    Table table = new Table().withId(UUID.randomUUID()).withService(serviceReference(service));
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.getEntityType()).thenReturn(Entity.TABLE);
    ResourceContext<Table> context = new ResourceContext<>(Entity.TABLE, table, repository);

    assertEquals(
        List.of("Environment.Development"),
        context.getServiceTags().stream().map(TagLabel::getTagFQN).toList());
    assertEquals("Snowflake", context.getServiceType());
    context.getServiceTags();

    verify(serviceRepository, times(1))
        .get(isNull(), any(UUID.class), any(Fields.class), any(Include.class), anyBoolean());
  }

  /**
   * A service is its own service, so a condition over service attributes hides the service itself
   * alongside its assets. Its own tags come from the entity's on-demand tag load, not from a second
   * read of the same row.
   */
  @Test
  void serviceResource_isItsOwnService() {
    DatabaseService service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("snowflake-sandbox")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withTags(List.of(new TagLabel().withTagFQN("Environment.Development")));
    DatabaseServiceRepository serviceRepository = registerDatabaseService(service);

    ResourceContext<DatabaseService> context =
        new ResourceContext<>(Entity.DATABASE_SERVICE, service, serviceRepository);

    assertEquals(service.getId(), context.getServiceReference().getId());
    assertEquals(
        List.of("Environment.Development"),
        context.getServiceTags().stream().map(TagLabel::getTagFQN).toList());
    assertEquals("Snowflake", context.getServiceType());
    verify(serviceRepository, never())
        .get(isNull(), any(UUID.class), any(Fields.class), any(Include.class), anyBoolean());
  }

  private static EntityReference serviceReference(DatabaseService service) {
    return new EntityReference()
        .withId(service.getId())
        .withType(Entity.DATABASE_SERVICE)
        .withName(service.getName());
  }

  /**
   * Registrations are global and never torn down, so the stand-in has to answer the indexing policy
   * hooks the way a real repository does — a bare mock answers false and would report every
   * database service as non-indexable for the rest of the JVM.
   */
  private static DatabaseServiceRepository registerDatabaseService(DatabaseService service) {
    DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    org.mockito.Mockito.doReturn(true).when(repository).isSearchIndexable(any());
    org.mockito.Mockito.doReturn(true).when(repository).isVectorEmbeddable(any());
    when(repository.getEntityType()).thenReturn(Entity.DATABASE_SERVICE);
    when(repository.isSupportsTags()).thenReturn(true);
    when(repository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(repository.getAllTags(any())).thenReturn(service.getTags());
    when(repository.get(
            isNull(), any(UUID.class), any(Fields.class), any(Include.class), anyBoolean()))
        .thenReturn(service);
    Entity.registerEntity(DatabaseService.class, Entity.DATABASE_SERVICE, repository);
    return repository;
  }
}
