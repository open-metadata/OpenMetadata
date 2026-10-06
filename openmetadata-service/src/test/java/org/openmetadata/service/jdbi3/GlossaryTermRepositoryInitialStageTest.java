/*
 *  Copyright 2026 Collate.
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
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * A new glossary term needs review when the parent term or glossary it is created under has
 * reviewers, so it starts in Draft there, whatever its create request asked for, and Approved
 * anywhere else.
 */
class GlossaryTermRepositoryInitialStageTest {
  private static final List<EntityReference> REVIEWERS =
      List.of(
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.USER)
              .withName("alice")
              .withFullyQualifiedName("alice"));

  private GlossaryTermRepository repository;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    repository = new GlossaryTermRepository(false);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @Test
  void termWithNoReviewersAboveItStartsApproved() {
    GlossaryTerm term = newTerm(storedGlossary(List.of()), null);

    repository.assignInitialEntityStatus(term);

    assertEquals(EntityStatus.APPROVED, term.getEntityStatus());
  }

  @Test
  void termInAGlossaryWithReviewersStartsInDraftWhateverItsRequestAsks() {
    GlossaryTerm term =
        newTerm(storedGlossary(REVIEWERS), null).withEntityStatus(EntityStatus.APPROVED);

    repository.assignInitialEntityStatus(term);

    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());
  }

  @Test
  void termUnderAParentTermWithReviewersStartsInDraft() {
    GlossaryTerm term = newTerm(storedGlossary(List.of()), storedParentTerm(REVIEWERS));

    repository.assignInitialEntityStatus(term);

    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());
  }

  private static GlossaryTerm newTerm(EntityReference glossary, EntityReference parent) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("net_revenue")
        .withGlossary(glossary)
        .withParent(parent);
  }

  private static EntityReference storedGlossary(List<EntityReference> reviewers) {
    Glossary glossary =
        new Glossary().withId(UUID.randomUUID()).withName("finance").withReviewers(reviewers);
    return stored(Entity.GLOSSARY, Glossary.class, glossary);
  }

  private static EntityReference storedParentTerm(List<EntityReference> reviewers) {
    GlossaryTerm parent =
        new GlossaryTerm().withId(UUID.randomUUID()).withName("revenue").withReviewers(reviewers);
    return stored(Entity.GLOSSARY_TERM, GlossaryTerm.class, parent);
  }

  @SuppressWarnings("unchecked")
  private static <E extends EntityInterface> EntityReference stored(
      String entityType, Class<E> entityClass, E entity) {
    EntityRepository<E> store = mock(EntityRepository.class);
    when(store.get(any(), eq(entity.getId()), any(), any(Include.class), anyBoolean()))
        .thenReturn(entity);
    Entity.registerEntity(entityClass, entityType, store);
    return new EntityReference().withId(entity.getId()).withType(entityType);
  }
}
