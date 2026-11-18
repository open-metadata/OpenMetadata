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
import static org.openmetadata.it.util.RelationshipTypeTestSupport.importInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.putType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relate;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationReads;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypeName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypesTowards;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.restoreType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.send;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.typeRequest;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.unrelate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RelationshipTypeTestSupport.Reply;
import org.openmetadata.it.util.SharedResourceLocks;
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
  private static final String SETTINGS = "/v1/system/settings";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private Glossary glossary;

  @BeforeEach
  void setup(TestNamespace ns) {
    glossary = GlossaryTestFactory.createWithName(ns, ns.uniqueShortId());
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aTypeAnotherTypeNamesAsItsInverseCannotBeDeleted(boolean hardDelete, TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType owner = pair.getFirst();
    RelationshipType inverse = pair.getLast();
    UUID whole = createTerm(glossary, ns.shortPrefix("whole"));
    UUID part = createTerm(glossary, ns.shortPrefix("part"));
    assertEquals(200, relate(whole, part, owner.getName()).status());

    Reply reply = deleteType(inverse.getId(), hardDelete);

    assertRejectedAsInUse(reply, "'" + owner.getName() + "' (inverse)");
    assertLive(inverse);
    assertAllSucceed(relationReads(glossary, whole, part));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void anImportedInversePairKeepsBothTypesAndReadsAsAuthored(boolean hardDelete, TestNamespace ns) {
    String first = relationTypeName(ns, "hasPart");
    String second = relationTypeName(ns, "partOf");
    List<UUID> terms = importInversePair(glossary, first, second);
    RelationshipType inverse = asType(getTypeByName(second));
    List<String> fromWhole = relationTypesTowards(terms.getFirst(), terms.getLast());
    List<String> fromPart = relationTypesTowards(terms.getLast(), terms.getFirst());

    Reply reply = deleteType(inverse.getId(), hardDelete);

    assertRejectedAsInUse(reply, "'" + first + "' (inverse)");
    assertLive(inverse);
    assertAllSucceed(relationReads(glossary, terms.getFirst(), terms.getLast()));
    assertEquals(fromWhole, relationTypesTowards(terms.getFirst(), terms.getLast()));
    assertEquals(fromPart, relationTypesTowards(terms.getLast(), terms.getFirst()));
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void theDeprecatedSettingsWriteRemovesAnInversePairTogetherButNotOneStillReferenced(
      TestNamespace ns) {
    String first = relationTypeName(ns, "legacyPrecedes");
    String second = relationTypeName(ns, "legacyFollows");
    JsonNode original = settingsRelationTypes();
    assertEquals(200, putSettings(withLegacyPair(original, first, second)).status());
    RelationshipType referrer = createType(relationTypeName(ns, "outsider"), first);

    Reply refused = putSettings(original);

    assertRejectedAsInUse(refused, "'" + referrer.getName() + "' (inverse)");
    assertTrue(settingsRelationTypes().toString().contains(first), "the setting was not saved");
    assertLive(asType(getTypeByName(first)));

    assertEquals(200, deleteType(referrer.getId(), true).status());
    assertEquals(200, putSettings(original).status());
    assertEquals(404, getTypeByName(first).status());
    assertEquals(404, getTypeByName(second).status());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aTypeStoredRelationsUseCannotBeDeletedUntilTheyAreRemoved(
      boolean hardDelete, TestNamespace ns) {
    RelationshipType cites = createType(relationTypeName(ns, "cites"), null);
    UUID paper = createTerm(glossary, ns.shortPrefix("paper"));
    UUID source = createTerm(glossary, ns.shortPrefix("source"));
    assertEquals(200, relate(paper, source, cites.getName()).status());

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
    RelationshipType referenced = createType(relationTypeName(ns, "referenced"), null);
    RelationshipType other = createType(relationTypeName(ns, "other"), null);
    String ownerName = relationTypeName(ns, "owner");
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
    RelationshipType target = createType(relationTypeName(ns, "target"), null);
    RelationshipType owner = createType(relationTypeName(ns, "owner"), target.getName());
    assertEquals(200, deleteType(owner.getId(), false).status());

    assertRejectedAsInUse(
        deleteType(target.getId(), true), "'" + owner.getName() + "' (inverse, soft-deleted)");

    assertEquals(200, deleteType(owner.getId(), true).status());
    assertEquals(200, deleteType(target.getId(), true).status());
  }

  @Test
  void aNewReferenceToASoftDeletedTypeIsRejected(TestNamespace ns) {
    RelationshipType deleted = createType(relationTypeName(ns, "retired"), null);
    assertEquals(200, deleteType(deleted.getId(), false).status());

    Reply reply = putType(typeRequest(relationTypeName(ns, "owner"), deleted.getName()));

    assertEquals(400, reply.status(), reply.message());
    assertTrue(reply.message().contains("is deleted; restore it first"), reply.message());
    assertAllSucceed(relationReads(glossary));
  }

  @Test
  void anUnreferencedCustomTypeCanBeSoftDeletedRestoredAndHardDeleted(TestNamespace ns) {
    RelationshipType unused = createType(relationTypeName(ns, "unused"), null);

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

  private static JsonNode settingsRelationTypes() {
    Reply reply = send("GET", SETTINGS + "/glossaryTermRelationSettings", null);
    assertEquals(200, reply.status(), reply.message());
    return reply.body().path("config_value").path("relationTypes");
  }

  private static ArrayNode withLegacyPair(JsonNode relationTypes, String first, String second) {
    ArrayNode updated = ((ArrayNode) relationTypes).deepCopy();
    updated.add(legacyType(first, second));
    updated.add(legacyType(second, first));
    return updated;
  }

  private static ObjectNode legacyType(String name, String inverse) {
    return MAPPER
        .createObjectNode()
        .put("name", name)
        .put("displayName", name)
        .put("description", "Legacy relation type " + name)
        .put("inverseRelation", inverse)
        .put("category", "associative")
        .put("isSystemDefined", false)
        .put("color", "#6941c6");
  }

  private static Reply putSettings(JsonNode relationTypes) {
    ObjectNode settings =
        MAPPER.createObjectNode().put("config_type", "glossaryTermRelationSettings");
    settings.putObject("config_value").set("relationTypes", relationTypes);
    return send("PUT", SETTINGS, settings.toString());
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
