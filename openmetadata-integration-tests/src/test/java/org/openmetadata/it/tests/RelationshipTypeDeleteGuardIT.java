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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.asType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createTerm;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.deleteType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getTypeByName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.putType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relate;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationReads;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.restoreType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.typeRequest;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.unrelate;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RelationshipTypeTestSupport.Reply;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.RelationshipType;

/**
 * A relationship type cannot be deleted while another type or a glossary term relation uses it
 * (ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted): every read of those relations
 * resolves the type, so deleting it made them fail with 400.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RelationshipTypeDeleteGuardIT {
  private static final String IN_USE = "is in use and cannot be deleted";

  private Glossary glossary;

  @BeforeEach
  void setup(TestNamespace ns) {
    glossary = GlossaryTestFactory.createSimple(ns);
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aTypeAnotherTypeNamesAsItsInverseCannotBeDeleted(boolean hardDelete, TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(ns.shortPrefix("hasPart"), ns.shortPrefix("partOf"));
    RelationshipType owner = pair.getFirst();
    RelationshipType inverse = pair.getLast();
    UUID whole = createTerm(glossary, ns.shortPrefix("whole"));
    UUID part = createTerm(glossary, ns.shortPrefix("part"));
    assertEquals(201, relate(whole, part, owner.getName()).status());

    Reply reply = deleteType(inverse.getId(), hardDelete);

    assertRejectedAsInUse(reply, "'" + owner.getName() + "' (inverse)");
    assertLive(inverse);
    assertAllSucceed(relationReads(glossary, whole, part));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aTypeStoredRelationsUseCannotBeDeletedUntilTheyAreRemoved(
      boolean hardDelete, TestNamespace ns) {
    RelationshipType cites = createType(ns.shortPrefix("cites"), null);
    UUID paper = createTerm(glossary, ns.shortPrefix("paper"));
    UUID source = createTerm(glossary, ns.shortPrefix("source"));
    assertEquals(201, relate(paper, source, cites.getName()).status());

    assertRejectedAsInUse(
        deleteType(cites.getId(), hardDelete), "used by 1 glossary term relation");
    assertLive(cites);
    assertAllSucceed(relationReads(glossary, paper, source));

    assertEquals(200, unrelate(paper, source, cites.getName()).status());
    assertEquals(200, deleteType(cites.getId(), hardDelete).status());
  }

  @ParameterizedTest
  @ValueSource(strings = {"propertyChain", "disjointWith", "replacedBy"})
  void aTypeReferencedInAnotherTypesDefinitionCannotBeDeleted(String field, TestNamespace ns) {
    RelationshipType referenced = createType(ns.shortPrefix("referenced"), null);
    RelationshipType other = createType(ns.shortPrefix("other"), null);
    String ownerName = ns.shortPrefix("owner");
    ObjectNode owner = typeRequest(ownerName, null);
    reference(owner, field, referenced, other);
    assertEquals(201, putType(owner).status());

    assertRejectedAsInUse(
        deleteType(referenced.getId(), true), "'" + ownerName + "' (" + field + ")");
    assertLive(referenced);
    assertAllSucceed(relationReads(glossary));

    assertEquals(200, putType(typeRequest(ownerName, null)).status());
    assertEquals(200, deleteType(referenced.getId(), true).status());
  }

  @Test
  void aSoftDeletedTypesReferenceStillBlocksTheDeleteSoARestoreCannotDangle(TestNamespace ns) {
    RelationshipType target = createType(ns.shortPrefix("target"), null);
    RelationshipType owner = createType(ns.shortPrefix("owner"), target.getName());
    assertEquals(200, deleteType(owner.getId(), false).status());

    assertRejectedAsInUse(
        deleteType(target.getId(), true), "'" + owner.getName() + "' (inverse, soft-deleted)");

    assertEquals(200, deleteType(owner.getId(), true).status());
    assertEquals(200, deleteType(target.getId(), true).status());
  }

  @Test
  void aNewReferenceToASoftDeletedTypeIsRejected(TestNamespace ns) {
    RelationshipType deleted = createType(ns.shortPrefix("retired"), null);
    assertEquals(200, deleteType(deleted.getId(), false).status());

    Reply reply = putType(typeRequest(ns.shortPrefix("owner"), deleted.getName()));

    assertEquals(400, reply.status(), reply.message());
    assertTrue(reply.message().contains("is deleted; restore it first"), reply.message());
    assertAllSucceed(relationReads(glossary));
  }

  @Test
  void anUnreferencedCustomTypeCanBeSoftDeletedRestoredAndHardDeleted(TestNamespace ns) {
    RelationshipType unused = createType(ns.shortPrefix("unused"), null);

    assertEquals(200, deleteType(unused.getId(), false).status());
    assertTrue(getType(unused.getId()).body().path("deleted").asBoolean());
    assertEquals(200, restoreType(unused.getId()).status());
    assertFalse(getType(unused.getId()).body().path("deleted").asBoolean());
    assertEquals(200, deleteType(unused.getId(), true).status());
    assertEquals(404, getType(unused.getId()).status());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aSystemTypeCannotBeDeleted(boolean hardDelete) {
    RelationshipType broader = asType(getTypeByName("broader"));

    Reply reply = deleteType(broader.getId(), hardDelete);

    assertEquals(400, reply.status(), reply.message());
    assertTrue(reply.message().contains("can not be deleted"), reply.message());
    assertLive(broader);
  }

  private static void reference(
      ObjectNode owner, String field, RelationshipType referenced, RelationshipType other) {
    switch (field) {
      case "propertyChain" -> owner.putArray(field).add(referenced.getName()).add(other.getName());
      case "disjointWith" -> owner.putArray(field).add(referenced.getName());
      default -> owner.put(field, referenced.getName());
    }
  }

  private static void assertRejectedAsInUse(Reply reply, String reason) {
    assertEquals(400, reply.status(), reply.message());
    assertTrue(reply.message().contains(IN_USE), reply.message());
    assertTrue(reply.message().contains(reason), reply.message());
  }

  private static void assertLive(RelationshipType type) {
    Reply reply = getType(type.getId());
    assertEquals(200, reply.status(), reply.message());
    assertFalse(reply.body().path("deleted").asBoolean(), reply.body().toString());
  }

  private static void assertAllSucceed(List<Reply> replies) {
    replies.forEach(reply -> assertEquals(200, reply.status(), reply.message()));
  }
}
