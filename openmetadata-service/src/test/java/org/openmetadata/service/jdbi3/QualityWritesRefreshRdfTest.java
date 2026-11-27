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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfLiveWrite;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Profiles and incident statuses are time-series rows, not entity updates, so no entity hook
 * projects them: each write refreshes the projection of the table or test case it is about.
 */
@Isolated
class QualityWritesRefreshRdfTest {
  private static final String TABLE_FQN = "svc.db.schema.orders";
  private static final long PROFILED_AT = 1_763_000_000_000L;

  private final List<RdfLiveWrite> queued = new ArrayList<>();
  private final Table table =
      new Table().withId(UUID.randomUUID()).withName("orders").withFullyQualifiedName(TABLE_FQN);
  private final CollectionDAO dao = mock(CollectionDAO.class);
  private final TimeSeriesDAOs.ProfilerDataTimeSeriesDAO profiles =
      mock(TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.class);
  private AutoCloseable capturedQueue;

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
  }

  @BeforeEach
  void captureTheLiveQueue() {
    capturedQueue = RdfUpdater.captureWrites(queued::addAll);
    when(dao.profilerDataTimeSeriesDao()).thenReturn(profiles);
  }

  @AfterEach
  void restoreTheLiveQueue() throws Exception {
    PostCommitActionQueue.clear();
    capturedQueue.close();
  }

  @Test
  void storingATableProfileRefreshesTheTable() throws ReflectiveOperationException {
    final TableRepository repository = tableRepository();
    doReturn(table).when(repository).find(table.getId(), Include.NON_DELETED);
    doReturn(table).when(repository).setFieldsInternal(any(Table.class), any(Fields.class));

    repository.addTableProfileData(
        table.getId(),
        new CreateTableProfile()
            .withTableProfile(new TableProfile().withTimestamp(PROFILED_AT).withRowCount(5.0)));

    assertEquals(List.of(refreshOfTheTable()), queued);
  }

  @Test
  void deletingAColumnProfileRefreshesItsTable() throws ReflectiveOperationException {
    final TableRepository repository = tableRepository();
    doReturn(table).when(repository).findByNameOrNull(TABLE_FQN, Include.NON_DELETED);

    repository.deleteTableProfile(TABLE_FQN + ".amount", "column", PROFILED_AT);

    assertEquals(List.of(refreshOfTheTable()), queued);
  }

  @Test
  void profilesWrittenThroughTheEntityProfileApiRefreshTheirTable()
      throws ReflectiveOperationException {
    final EntityProfileRepository repository =
        mock(EntityProfileRepository.class, Mockito.CALLS_REAL_METHODS);
    setField(EntityTimeSeriesRepository.class, repository, "timeSeriesDao", profiles);
    final UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getRequestUri()).thenReturn(URI.create("http://localhost/profiles"));

    repository.addProfileData(
        uriInfo,
        table,
        new CreateEntityProfile()
            .withTimestamp(PROFILED_AT)
            .withProfileType(CreateEntityProfile.ProfileTypeEnum.TABLE)
            .withProfileData(new TableProfile().withTimestamp(PROFILED_AT).withRowCount(5.0)));
    final TableRepository tables = tableRepository();
    doReturn(table).when(tables).findByNameOrNull(TABLE_FQN, Include.NON_DELETED);
    try (MockedStatic<Entity> entity =
        Mockito.mockStatic(Entity.class, Mockito.CALLS_REAL_METHODS)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tables);
      repository.deleteEntityProfile(Entity.TABLE, TABLE_FQN, new ListFilter(null), PROFILED_AT);
    }

    assertEquals(List.of(refreshOfTheTable(), refreshOfTheTable()), queued);
  }

  @Test
  void anIncidentStatusChangeRefreshesItsTestCase() throws ReflectiveOperationException {
    final TestCaseResolutionStatusRepository repository =
        mock(TestCaseResolutionStatusRepository.class, Mockito.CALLS_REAL_METHODS);
    setField(
        EntityTimeSeriesRepository.class,
        repository,
        "searchRepository",
        mock(SearchRepository.class));
    setField(
        EntityTimeSeriesRepository.class,
        repository,
        "entityClass",
        TestCaseResolutionStatus.class);
    final UUID testCaseId = UUID.randomUUID();
    final TestCaseResolutionStatus status =
        new TestCaseResolutionStatus()
            .withTestCaseReference(
                new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE));

    repository.postCreate(status);
    repository.postUpdate(status);

    final RdfLiveWrite refresh = new RdfLiveWrite.EntityUpdate(Entity.TEST_CASE, testCaseId);
    assertEquals(List.of(refresh, refresh), queued);
  }

  private RdfLiveWrite refreshOfTheTable() {
    return new RdfLiveWrite.EntityUpdate(Entity.TABLE, table.getId());
  }

  private TableRepository tableRepository() throws ReflectiveOperationException {
    final TableRepository repository = mock(TableRepository.class, Mockito.CALLS_REAL_METHODS);
    setField(EntityRepository.class, repository, "daoCollection", dao);
    return repository;
  }

  private static void setField(
      final Class<?> owner, final Object target, final String name, final Object value)
      throws ReflectiveOperationException {
    final Field field = owner.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }
}
