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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionKey;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.RelationshipKey;

/**
 * A hard delete of ontology definitions removes their relationship and extension rows by full
 * primary key, never by an id range (ADR:2026-11-08-native-ontology-writers-take-no-gap-locks).
 */
class OntologyHardDeleteKeysTest {
  private CollectionDAO previous;
  private CollectionDAO.EntityRelationshipDAO relationships;
  private CollectionDAO.EntityExtensionDAO extensions;

  @BeforeEach
  void useMockedStorage() {
    previous = Entity.getCollectionDAO();
    final CollectionDAO dao = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    relationships = mock(CollectionDAO.EntityRelationshipDAO.class);
    extensions = mock(CollectionDAO.EntityExtensionDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationships);
    when(dao.entityExtensionDAO()).thenReturn(extensions);
    Entity.setCollectionDAO(dao);
  }

  @AfterEach
  void restoreStorage() {
    Entity.setCollectionDAO(previous);
  }

  @Test
  void relationshipsAreDeletedByTheKeysReadForEachChunkOfDefinitions() {
    final List<UUID> ids = ids(250);
    final List<List<String>> chunks = new ArrayList<>();
    final List<List<RelationshipKey>> deleted = new ArrayList<>();
    when(relationships.findKeys(anyList(), anyString()))
        .thenAnswer(
            call -> {
              final List<String> chunk = List.copyOf(call.getArgument(0));
              chunks.add(chunk);
              return List.of(new RelationshipKey(chunk.getFirst(), "target", 0));
            });
    doAnswer(call -> deleted.add(List.copyOf(call.<List<RelationshipKey>>getArgument(0))))
        .when(relationships)
        .deleteByKeys(anyList());

    new OntologyConceptRepository().deleteRelationshipRows(ids);

    assertEquals(List.of(100, 100, 50), chunks.stream().map(List::size).toList());
    assertEquals(strings(ids), chunks.stream().flatMap(List::stream).toList());
    assertEquals(
        List.of(
            List.of(new RelationshipKey(ids.get(0).toString(), "target", 0)),
            List.of(new RelationshipKey(ids.get(100).toString(), "target", 0)),
            List.of(new RelationshipKey(ids.get(200).toString(), "target", 0))),
        deleted);
    verify(relationships, never()).batchDeleteRelationships(anyList(), any());
  }

  @Test
  void extensionsAreDeletedByTheKeysReadForTheDefinitions() {
    final List<UUID> ids = ids(2);
    final List<ExtensionKey> keys =
        List.of(
            new ExtensionKey(ids.get(0).toString(), "ontologyConcept.version.0.1"),
            new ExtensionKey(ids.get(1).toString(), "ontologyConcept.version.0.2"));
    when(extensions.findKeys(strings(ids))).thenReturn(keys);

    new OntologyConceptRepository().deleteExtensionRows(ids);

    verify(extensions).deleteByKeys(keys);
    verify(extensions, never()).deleteAllBatch(anyList());
  }

  private static List<UUID> ids(final int count) {
    return IntStream.range(0, count).mapToObj(index -> UUID.randomUUID()).toList();
  }

  private static List<String> strings(final List<UUID> ids) {
    return ids.stream().map(UUID::toString).toList();
  }
}
