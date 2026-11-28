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
package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.OptionalDouble;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;

class TriggeringChangeTest {
  private static final UUID TERM_ID = UUID.randomUUID();

  @SuppressWarnings("unchecked")
  private final EntityRepository<GlossaryTerm> repository = mock(EntityRepository.class);

  private MockedStatic<Entity> entities;

  @BeforeEach
  void stubTheRepository() {
    entities = mockStatic(Entity.class);
    entities.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(Entity.GLOSSARY_TERM);
    entities.when(() -> Entity.getEntityRepository(Entity.GLOSSARY_TERM)).thenReturn(repository);
  }

  @AfterEach
  void releaseTheRepository() {
    entities.close();
  }

  @Test
  void anEditStoredBeforeTheRunBeginsWhereThatEditWasMade() {
    when(repository.getVersion(TERM_ID, "0.4")).thenReturn(term(0.4, 0.3));

    assertEquals(OptionalDouble.of(0.3), TriggeringChange.baseVersion(term(0.6, 0.5), 0.4));
  }

  @Test
  void aRunStillAtItsVersionBeginsWhereTheCurrentChangeWasMade() {
    assertEquals(OptionalDouble.of(0.5), TriggeringChange.baseVersion(term(0.6, 0.5), 0.6));
  }

  @Test
  void aCreateBeginsAtVersionZero() {
    when(repository.getVersion(TERM_ID, "0.1"))
        .thenReturn(new GlossaryTerm().withId(TERM_ID).withVersion(0.1));

    assertEquals(OptionalDouble.of(0.0), TriggeringChange.baseVersion(term(0.3, 0.2), 0.1));
  }

  @Test
  void aRunWithoutATriggeringVersionHasNoBase() {
    assertEquals(OptionalDouble.empty(), TriggeringChange.baseVersion(term(0.3, 0.2), null));
  }

  // An edit undone within its session leaves no version behind; nothing it made is under review.
  @Test
  void aTriggeringVersionTheHistoryNoLongerHasBeginsAtTheVersionBeforeIt() {
    when(repository.getVersion(TERM_ID, "0.4"))
        .thenThrow(EntityNotFoundException.byMessage("version 0.4 not found"));

    assertEquals(OptionalDouble.of(0.3), TriggeringChange.baseVersion(term(0.3, 0.2), 0.4));
  }

  private static GlossaryTerm term(double version, double previous) {
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withFullyQualifiedName("glossary.term")
        .withVersion(version)
        .withChangeDescription(new ChangeDescription().withPreviousVersion(previous));
  }
}
