/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;

class TriggeringChangeTest {
  private static final UUID ID = UUID.randomUUID();

  @Test
  void aRunWithoutAVersionJudgesTheEntitysChange() {
    Glossary entity = glossary(0.3, change("tags"));
    assertSame(entity.getChangeDescription(), TriggeringChange.of(entity, null));
  }

  @Test
  void anEntityStillAtTheEventsVersionJudgesItsOwnChange() {
    Glossary entity = glossary(0.2, change("tags"));
    assertSame(entity.getChangeDescription(), TriggeringChange.of(entity, 0.2));
  }

  @SuppressWarnings("unchecked")
  @Test
  void anEntityThatMovedOnJudgesTheChangeOfTheEventsVersion() {
    Glossary entity = glossary(0.3, change("tags"));
    Glossary atEvent = glossary(0.2, change("description"));
    EntityRepository<Glossary> repository = mock(EntityRepository.class);
    when(repository.getVersion(ID, "0.2")).thenReturn(atEvent);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(Entity.GLOSSARY);
      entities.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(repository);

      assertSame(atEvent.getChangeDescription(), TriggeringChange.of(entity, 0.2));
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void aVersionMissingFromTheHistoryJudgesTheEntitysChange() {
    Glossary entity = glossary(0.3, change("tags"));
    EntityRepository<Glossary> repository = mock(EntityRepository.class);
    when(repository.getVersion(ID, "0.2")).thenThrow(EntityNotFoundException.byMessage("gone"));
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(Entity.GLOSSARY);
      entities.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(repository);

      assertSame(entity.getChangeDescription(), TriggeringChange.of(entity, 0.2));
    }
  }

  private static Glossary glossary(double version, ChangeDescription change) {
    return new Glossary()
        .withId(ID)
        .withName("glossary")
        .withFullyQualifiedName("glossary")
        .withVersion(version)
        .withChangeDescription(change);
  }

  private static ChangeDescription change(String field) {
    return new ChangeDescription().withFieldsUpdated(List.of(new FieldChange().withName(field)));
  }
}
