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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.attachments.AssetType;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.slf4j.LoggerFactory;

/**
 * ERROR logs are shipped to Sentry, so an asset lookup that finds nothing (an expected 404 the
 * attachments widget triggers on every page without attachments) must not log at ERROR, while a
 * real read failure still must.
 */
class AssetRepositoryTest {
  private final CollectionDAO.AssetDAO dao = mock(CollectionDAO.AssetDAO.class);
  private final AssetRepository repository = new AssetRepository(dao);
  private Logger logger;
  private ListAppender<ILoggingEvent> appender;

  @BeforeEach
  void attachAppender() {
    logger = (Logger) LoggerFactory.getLogger(AssetRepository.class);
    appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void detachAppender() {
    logger.detachAppender(appender);
  }

  @Test
  void getByFqnWithNoAttachmentsThrowsNotFoundWithoutErrorLog() {
    when(dao.getByFqnExact(anyString(), anyString())).thenReturn(List.of());

    assertThrows(
        EntityNotFoundException.class,
        () -> repository.getByFQN("Article_without_attachments", AssetType.Inline));

    assertEquals(List.of(), errorMessages());
  }

  @Test
  void getByIdWithUnknownIdThrowsNotFoundWithoutErrorLog() {
    when(dao.getById(anyString())).thenReturn(null);

    assertThrows(EntityNotFoundException.class, () -> repository.getById("missing-id"));

    assertEquals(List.of(), errorMessages());
  }

  @Test
  void getByFqnPrefixWithNoMatchesThrowsNotFoundWithoutErrorLog() {
    when(dao.getByFqnPrefix(anyString(), anyString())).thenReturn(List.of());

    assertThrows(
        EntityNotFoundException.class,
        () -> repository.getByFqnPrefix("ContextCenter", AssetType.External));

    assertEquals(List.of(), errorMessages());
  }

  @Test
  void getByFqnReadFailureIsStillLoggedAtError() {
    when(dao.getByFqnExact(anyString(), anyString()))
        .thenThrow(new IllegalStateException("connection reset"));

    assertThrows(
        IllegalStateException.class, () -> repository.getByFQN("Article_x", AssetType.Inline));

    List<String> errors = errorMessages();
    assertEquals(1, errors.size());
    assertTrue(errors.get(0).contains("connection reset"));
  }

  private List<String> errorMessages() {
    return appender.list.stream()
        .filter(event -> event.getLevel() == Level.ERROR)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }
}
