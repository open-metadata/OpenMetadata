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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension.ExtensionType;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Regression guard for forward-compatible app-extension reads.
 *
 * <p>Extension rows outlive the code that wrote them. A newer build can add a field to an extension
 * payload and later be rolled back, leaving rows the running schema does not recognise. The bulk
 * {@code listAppExtension*} readers aggregate rows, so one unparseable row would fail the entire
 * scan; the {@code getLatestExtension*} readers return the newest row, which is the one most likely
 * to carry a field written by that newer build. A single such row must not break either path.
 */
class AppRepositoryExtensionCompatibilityTest {

  /** A STATUS row written by a newer build that knows a field this schema does not. */
  private static final String RUN_RECORD_FROM_NEWER_BUILD =
      "{\"appName\":\"TestApp\",\"status\":\"success\",\"fieldAddedByANewerBuild\":\"abc\"}";

  private static AppRepository repositoryBackedBy(List<String> extensionRows) {
    CollectionDAO.AppExtensionTimeSeries extensionDao =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    when(extensionDao.listAppExtensionCountByName(
            org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(extensionRows.size());
    when(extensionDao.listAppExtensionByName(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(extensionRows);

    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.appExtensionTimeSeriesDao()).thenReturn(extensionDao);

    AppRepository repository =
        mock(AppRepository.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
    injectDaoCollection(repository, daoCollection);
    return repository;
  }

  private static void injectDaoCollection(AppRepository repository, CollectionDAO daoCollection) {
    try {
      Field field = EntityRepository.class.getDeclaredField("daoCollection");
      field.setAccessible(true);
      field.set(repository, daoCollection);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Could not inject daoCollection for test", e);
    }
  }

  private static App app() {
    return new App().withId(UUID.randomUUID()).withName("TestApp");
  }

  @Test
  void bulkReadSkipsNothingWhenRowHasUnknownField() {
    AppRepository repository = repositoryBackedBy(List.of(RUN_RECORD_FROM_NEWER_BUILD));

    var result =
        repository.listAppExtensionByName(app(), 10, 0, AppRunRecord.class, ExtensionType.STATUS);

    assertEquals(1, result.getData().size());
    assertEquals(AppRunRecord.Status.SUCCESS, result.getData().getFirst().getStatus());
  }

  @Test
  void latestReadToleratesRowWrittenByNewerBuild() {
    AppRepository repository = repositoryBackedBy(List.of(RUN_RECORD_FROM_NEWER_BUILD));

    AppRunRecord latest =
        repository.getLatestExtensionByName(app(), AppRunRecord.class, ExtensionType.STATUS);

    assertNotNull(latest);
    assertEquals("TestApp", latest.getAppName());
    assertEquals(AppRunRecord.Status.SUCCESS, latest.getStatus());
  }

  /**
   * Documents why the lenient read is needed: the default strict mapper rejects the same payload
   * outright, so the two tests above genuinely fail if a call site reverts to {@code readValue}.
   */
  @Test
  void strictReadRejectsTheSamePayload() {
    assertThrows(
        JsonParsingException.class,
        () -> JsonUtils.readValue(RUN_RECORD_FROM_NEWER_BUILD, AppRunRecord.class));
  }
}
