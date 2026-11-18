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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Defends the fix for the dangling-inverse bug: a stored {@link RelationshipType} whose inverse
 * pointed at a never-registered name broke every TO-side {@code ?fields=relatedTerms} read (see
 * GlossaryTermRepository.applyInverse). The repository's hydrate step is the last write-time
 * guard against persisting such a dangling reference for the public REST path (the RDF glossary
 * importer and seed loader pre-stamp ids that bypass this branch on purpose — see {@link
 * GlossaryRdfImporter#buildRelationType} and {@code RelationshipTypeSeedLoader}).
 */
class RelationshipTypeRepositoryHydrateTest {

  private CollectionDAO collectionDAOMock;
  private CollectionDAO.RelationshipTypeDAO relationshipTypeDAOMock;

  @BeforeEach
  void setUp() {
    collectionDAOMock = mock(CollectionDAO.class);
    relationshipTypeDAOMock = mock(CollectionDAO.RelationshipTypeDAO.class);
    when(collectionDAOMock.relationshipTypeDAO()).thenReturn(relationshipTypeDAOMock);
    Entity.setCollectionDAO(collectionDAOMock);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @Test
  void rejectsInverseReferenceWhenFqnDoesNotResolve() {
    // Mimic the public REST path: the client supplies inverse.fqn but no id. Hydrate must look
    // up by fqn and reject when nothing resolves, rather than persisting a non-resolving pointer.
    when(relationshipTypeDAOMock.findEntityByName("prescribedBy", Include.ALL))
        .thenThrow(new EntityNotFoundException("missing"));

    RelationshipTypeRepository repository = new RelationshipTypeRepository();
    RelationshipType type =
        new RelationshipType()
            .withId(UUID.randomUUID())
            .withName("prescribes")
            .withRdfPredicate(URI.create("https://example.org/rel/prescribes"))
            .withInverse(
                new EntityReference()
                    .withType(Entity.RELATIONSHIP_TYPE)
                    .withFullyQualifiedName("prescribedBy"));

    // Bypass the in-process caches so the mock DAO is the only thing answering the lookup.
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      BadRequestException ex =
          assertThrows(BadRequestException.class, () -> repository.prepare(type, false));
      assertTrue(
          ex.getMessage().contains("prescribedBy"),
          "the error identifies the unresolvable name: " + ex.getMessage());
      assertTrue(
          ex.getMessage().contains("is not registered"),
          "the error states the reference is not registered: " + ex.getMessage());
    }
  }

  @Test
  void trustsPreStampedIdWithoutExistingLookup() throws Exception {
    // Both the seed loader and the RDF glossary importer pre-stamp
    // RelationshipTypeIds.stableId(name) for both halves of a mutual-inverse pair; the referent
    // of the first half persisted does not yet exist in the DB. Hydrate must short-circuit on a
    // pre-stamped id and NOT perform an existence-by-id lookup, otherwise both batch paths
    // would break on the first member of a mutual-inverse pair.
    UUID stamped = UUID.randomUUID();
    RelationshipTypeRepository repository = new RelationshipTypeRepository();
    EntityReference ref =
        new EntityReference()
            .withId(stamped)
            .withType(Entity.RELATIONSHIP_TYPE)
            .withFullyQualifiedName("prescribedBy");

    EntityReference result =
        (EntityReference) hydrateMethod().invoke(repository, ref, "prescribes", UUID.randomUUID());

    assertEquals(
        stamped, result.getId(), "pre-stamped id is preserved without an existence lookup");
  }

  private static Method hydrateMethod() throws NoSuchMethodException {
    Method hydrate =
        RelationshipTypeRepository.class.getDeclaredMethod(
            "hydrate", EntityReference.class, String.class, UUID.class);
    hydrate.setAccessible(true);
    return hydrate;
  }
}
