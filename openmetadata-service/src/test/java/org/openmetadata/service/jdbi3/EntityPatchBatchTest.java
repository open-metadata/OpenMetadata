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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityPatchBatch.EntityEdit;
import org.openmetadata.service.jdbi3.EntityPatchBatch.PatchBatchResult;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.security.PatchRequester;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PatchResponse;

class EntityPatchBatchTest {

  private static final String EDITED = "edited";
  private static final ChangeActor ACTOR = new ChangeActor("steward", null);

  private DatabaseSchemaRepository repository;
  private Authorizer authorizer;
  private PatchRequester requester;
  private final Map<UUID, DatabaseSchema> stored = new HashMap<>();

  @BeforeEach
  void setUp() {
    repository = mock(DatabaseSchemaRepository.class);
    authorizer = mock(Authorizer.class);
    requester = new PatchRequester(mock(SecurityContext.class), authorizer, ACTOR);
    Fields fields = new Fields(Set.of(Entity.FIELD_TAGS, Entity.FIELD_OWNERS));
    when(repository.getEntityType()).thenReturn(Entity.DATABASE_SCHEMA);
    when(repository.getEntityClass()).thenReturn(DatabaseSchema.class);
    when(repository.getPatchFields()).thenReturn(fields);
    when(repository.getFields(any(String.class))).thenReturn(fields);
    when(repository.get(isNull(), anyList(), any(Fields.class), eq(Include.NON_DELETED)))
        .thenAnswer(call -> load(call.getArgument(1)));
    when(repository.patch(any(DatabaseSchema.class), any(JsonPatch.class), eq(ACTOR)))
        .thenAnswer(call -> saved(call.getArgument(0), call.getArgument(1)));
  }

  @Test
  void eachChangedEntityIsSavedAsItsOwnPatchAndTheirEventsAreInsertedTogether() {
    List<DatabaseSchema> schemas = schemas(2);

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertTrue(result.failures().isEmpty());
    assertEquals(ids(schemas), result.changed());
    verify(repository, times(2)).patch(any(DatabaseSchema.class), any(JsonPatch.class), eq(ACTOR));
    verify(authorizer, times(2))
        .authorize(any(SecurityContext.class), any(OperationContext.class), any());
    verify(repository).insertChangeEventsBatch(argThat(events -> events.size() == 2));
  }

  @Test
  void anEntityTheEditLeavesAsItWasIsNeitherAuthorizedNorSaved() {
    List<DatabaseSchema> schemas = schemas(1);

    PatchBatchResult result =
        batch(false).apply(describe(schemas, schemas.getFirst().getDescription()));

    assertTrue(result.failures().isEmpty());
    assertTrue(result.changed().isEmpty());
    verify(authorizer, never()).authorize(any(), any(), any());
    verify(repository, never()).patch(any(DatabaseSchema.class), any(JsonPatch.class), any());
  }

  @Test
  void anEntityTheRequesterMayNotEditFailsAloneAndKeepsNoChange() {
    List<DatabaseSchema> schemas = schemas(2);
    UUID denied = schemas.getFirst().getId();
    doThrow(new AuthorizationException("not allowed"))
        .when(authorizer)
        .authorize(any(SecurityContext.class), any(OperationContext.class), aboutEntity(denied));

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertEquals(Map.of(denied, "not allowed"), result.failures());
    assertEquals(List.of(schemas.get(1).getId()), result.changed());
    verify(repository, never())
        .patch(argThat(schema -> denied.equals(schema.getId())), any(JsonPatch.class), any());
  }

  @Test
  void anEntityWhoseSaveFailsIsReportedWithItsMessage() {
    List<DatabaseSchema> schemas = schemas(2);
    UUID failing = schemas.getFirst().getId();
    doThrow(new IllegalArgumentException("rule failed"))
        .when(repository)
        .patch(argThat(schema -> failing.equals(schema.getId())), any(JsonPatch.class), eq(ACTOR));

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertEquals(Map.of(failing, "rule failed"), result.failures());
    assertEquals(List.of(schemas.get(1).getId()), result.changed());
    verify(repository).insertChangeEventsBatch(argThat(events -> events.size() == 1));
  }

  @Test
  void anEntityThatNoLongerExistsFailsAsNotFound() {
    UUID missing = UUID.randomUUID();

    PatchBatchResult result = batch(false).apply(List.of(new EntityEdit<>(missing, schema -> {})));

    assertTrue(result.failures().get(missing).contains(missing.toString()));
    assertTrue(result.changed().isEmpty());
  }

  @Test
  void aSaveThatChangesNothingRecordsNoEvent() {
    List<DatabaseSchema> schemas = schemas(1);
    when(repository.patch(any(DatabaseSchema.class), any(JsonPatch.class), eq(ACTOR)))
        .thenAnswer(
            call ->
                new PatchResponse<>(Status.OK, call.getArgument(0), EventType.ENTITY_NO_CHANGE));

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertTrue(result.changed().isEmpty());
    verify(repository).insertChangeEventsBatch(List.of());
  }

  @Test
  void aDryRunAuthorizesAndPreparesEachPatchAndSavesNothing() {
    List<DatabaseSchema> schemas = schemas(2);

    PatchBatchResult result = batch(true).apply(describe(schemas, EDITED));

    assertEquals(ids(schemas), result.changed());
    verify(authorizer, times(2))
        .authorize(any(SecurityContext.class), any(OperationContext.class), any());
    verify(repository, times(2))
        .preparePatch(any(DatabaseSchema.class), any(JsonPatch.class), eq(ACTOR));
    verify(repository, never()).patch(any(DatabaseSchema.class), any(JsonPatch.class), any());
    verify(repository).insertChangeEventsBatch(List.of());
  }

  @Test
  void editsAreLoadedAndRecordedInGroupsOfAHundred() {
    List<DatabaseSchema> schemas = schemas(250);

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertEquals(250, result.changed().size());
    verify(repository, times(3))
        .get(isNull(), anyList(), any(Fields.class), eq(Include.NON_DELETED));
    verify(repository, times(2)).insertChangeEventsBatch(argThat(events -> events.size() == 100));
    verify(repository).insertChangeEventsBatch(argThat(events -> events.size() == 50));
  }

  @Test
  void aGroupThatCannotBeLoadedFailsAloneAndTheGroupBeforeItStaysSaved() {
    List<DatabaseSchema> schemas = schemas(150);
    when(repository.get(isNull(), anyList(), any(Fields.class), eq(Include.NON_DELETED)))
        .thenAnswer(call -> load(call.getArgument(1)))
        .thenThrow(new IllegalStateException("database unavailable"));

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertEquals(ids(schemas.subList(0, 100)), result.changed());
    assertEquals(Set.copyOf(ids(schemas.subList(100, 150))), result.failures().keySet());
    assertTrue(result.failures().values().stream().allMatch("database unavailable"::equals));
  }

  @Test
  void entitiesSavedBeforeTheirGroupFailsStayReportedAsChanged() {
    List<DatabaseSchema> schemas = schemas(2);
    doThrow(new IllegalStateException("events not recorded"))
        .when(repository)
        .insertChangeEventsBatch(anyList());

    PatchBatchResult result = batch(false).apply(describe(schemas, EDITED));

    assertEquals(ids(schemas), result.changed());
    assertTrue(result.failures().isEmpty());
  }

  private EntityPatchBatch<DatabaseSchema> batch(boolean dryRun) {
    return new EntityPatchBatch<>(repository, requester, dryRun);
  }

  private List<DatabaseSchema> schemas(int count) {
    List<DatabaseSchema> schemas =
        IntStream.range(0, count)
            .mapToObj(
                i ->
                    new DatabaseSchema()
                        .withId(UUID.randomUUID())
                        .withName("schema" + i)
                        .withFullyQualifiedName("svc.db.schema" + i)
                        .withDescription("original")
                        .withVersion(0.1)
                        .withUpdatedAt(1L)
                        .withUpdatedBy("admin"))
            .toList();
    stored.putAll(schemas.stream().collect(Collectors.toMap(DatabaseSchema::getId, s -> s)));
    return schemas;
  }

  private List<DatabaseSchema> load(Collection<UUID> ids) {
    List<DatabaseSchema> found = new ArrayList<>();
    ids.stream()
        .filter(stored::containsKey)
        .map(id -> JsonUtils.deepCopy(stored.get(id), DatabaseSchema.class))
        .forEach(found::add);
    return found;
  }

  private static PatchResponse<DatabaseSchema> saved(DatabaseSchema original, JsonPatch patch) {
    DatabaseSchema updated = JsonUtils.applyPatch(original, patch, DatabaseSchema.class);
    return new PatchResponse<>(Status.OK, updated.withVersion(0.2), EventType.ENTITY_UPDATED);
  }

  private static List<EntityEdit<DatabaseSchema>> describe(
      List<DatabaseSchema> schemas, String description) {
    return schemas.stream()
        .map(
            schema ->
                new EntityEdit<DatabaseSchema>(
                    schema.getId(), loaded -> loaded.setDescription(description)))
        .toList();
  }

  private static List<UUID> ids(List<DatabaseSchema> schemas) {
    return schemas.stream().map(DatabaseSchema::getId).toList();
  }

  private static ResourceContextInterface aboutEntity(UUID id) {
    return argThat(context -> context != null && id.equals(context.getEntity().getId()));
  }
}
