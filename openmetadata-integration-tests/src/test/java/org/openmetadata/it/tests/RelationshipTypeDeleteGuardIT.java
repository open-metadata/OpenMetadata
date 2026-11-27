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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.asType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createTerm;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.deleteType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getTypeByName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.importInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.inverseOf;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.putType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relate;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationReads;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypeName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypesTowards;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.restoreType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.send;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.typeRequest;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.unrelate;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.updateEventsSince;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
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
import org.junit.jupiter.params.provider.CsvSource;
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
  @CsvSource({"false,false", "false,true", "true,false", "true,true"})
  void eitherSideOfAnUnusedPairCanBeDeletedAndThePartnersInverseIsCleared(
      boolean hardDelete, boolean deleteFirst, TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType deleted = deleteFirst ? pair.getFirst() : pair.getLast();
    RelationshipType partner = deleteFirst ? pair.getLast() : pair.getFirst();
    long before = System.currentTimeMillis();

    Reply reply = deleteType(deleted.getId(), hardDelete);

    assertEquals(200, reply.status(), reply.message());
    assertLive(partner);
    assertNull(inverseOf(partner.getId()));
    assertTrue(
        updateEventsSince(partner.getId(), before).stream()
            .anyMatch(event -> event.path("changeDescription").toString().contains("inverse")),
        "the partner's inverse change is recorded as a change event");
    assertAllSucceed(relationReads(glossary));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aPairWithARelationStoredAsEitherSideKeepsBothSides(
      boolean authoredFromTheHigherId, TestNamespace ns) {
    // An imported pair names its inverses, which is what makes storage swap to the inverse.
    String first = relationTypeName(ns, "hasPart");
    String second = relationTypeName(ns, "partOf");
    for (UUID seeded : importInversePair(glossary, first, second)) {
      Reply deleted = send("DELETE", "/v1/glossaryTerms/" + seeded + "?hardDelete=true", null);
      assertEquals(200, deleted.status(), deleted.message());
    }
    List<RelationshipType> pair =
        List.of(asType(getTypeByName(first)), asType(getTypeByName(second)));
    UUID one = createTerm(glossary, ns.shortPrefix("one"));
    UUID two = createTerm(glossary, ns.shortPrefix("two"));
    UUID lower = one.compareTo(two) < 0 ? one : two;
    UUID higher = one.compareTo(two) < 0 ? two : one;
    RelationshipType authored = pair.getFirst();
    RelationshipType partner = pair.getLast();
    // A relation is stored from the lower term id, so one authored from the higher id is stored
    // as the authored type's inverse.
    assertEquals(
        200,
        (authoredFromTheHigherId
                ? relate(higher, lower, authored.getName())
                : relate(lower, higher, authored.getName()))
            .status());
    RelationshipType stored = authoredFromTheHigherId ? partner : authored;
    RelationshipType other = authoredFromTheHigherId ? authored : partner;

    assertRejectedAsInUse(deleteType(stored.getId(), false), "used by 1 glossary term relation");
    assertRejectedAsInUse(
        deleteType(other.getId(), true),
        "its inverse '" + stored.getName() + "' is used by 1 glossary term relation");
    assertLive(authored);
    assertLive(partner);
    assertEquals(partner.getName(), inverseOf(authored.getId()));
    assertEquals(authored.getName(), inverseOf(partner.getId()));
    assertAllSucceed(relationReads(glossary, lower, higher));
  }

  @Test
  void aBackLinkWithAnotherReferenceStillBlocksAndKeepsThePair(TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType deleted = pair.getFirst();
    String ownerName = relationTypeName(ns, "successor");
    assertEquals(
        201, putType(typeRequest(ownerName, null).put("replacedBy", deleted.getName())).status());

    Reply reply = deleteType(deleted.getId(), true);

    assertRejectedAsInUse(reply, "'" + ownerName + "' (replacedBy)");
    assertFalse(reply.message().contains("(inverse)"), reply.message());
    assertEquals(deleted.getName(), inverseOf(pair.getLast().getId()));
  }

  @Test
  void restoringADeletedSideLinksItsUnusedPartnerBack(TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType deleted = pair.getFirst();
    RelationshipType partner = pair.getLast();
    assertEquals(200, deleteType(deleted.getId(), false).status());
    assertNull(inverseOf(partner.getId()));

    Reply reply = restoreType(deleted.getId());

    assertEquals(200, reply.status(), reply.message());
    assertEquals(partner.getName(), inverseOf(deleted.getId()));
    assertEquals(deleted.getName(), inverseOf(partner.getId()));
    assertAllSucceed(relationReads(glossary));
  }

  @Test
  void restoringALiveTypeIsRefusedAndChangesNothing(TestNamespace ns) {
    RelationshipType target = createType(relationTypeName(ns, "target"), null);
    RelationshipType owner = createType(relationTypeName(ns, "owner"), target.getName());
    double ownerVersion = asType(getType(owner.getId())).getVersion();

    Reply reply = restoreType(owner.getId());

    assertEquals(400, reply.status(), reply.message());
    assertTrue(reply.message().contains("is not in deleted state"), reply.message());
    assertNull(inverseOf(target.getId()));
    assertEquals(ownerVersion, asType(getType(owner.getId())).getVersion());
  }

  @Test
  void aRestoredApiPairReadsItsRelationsAsOneNeverDeleted(TestNamespace ns) {
    List<RelationshipType> restored =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    List<RelationshipType> control =
        createInversePair(relationTypeName(ns, "contains"), relationTypeName(ns, "within"));
    assertEquals(200, deleteType(restored.getFirst().getId(), false).status());
    assertEquals(200, restoreType(restored.getFirst().getId()).status());

    assertEquals(
        inverseShape(control.getLast()),
        inverseShape(restored.getLast()),
        "the link back is written as the pair was");
    assertEquals(readsFromBothEnds(ns, control, "c"), readsFromBothEnds(ns, restored, "r"));
  }

  @Test
  void aTermRelationNamingADeletedTypeSaysToRestoreIt(TestNamespace ns) {
    RelationshipType retired = createType(relationTypeName(ns, "retired"), null);
    assertEquals(200, deleteType(retired.getId(), false).status());
    UUID from = createTerm(glossary, ns.shortPrefix("from"));
    UUID to = createTerm(glossary, ns.shortPrefix("to"));

    Reply reply = relate(from, to, retired.getName());

    assertEquals(400, reply.status(), reply.message());
    assertTrue(
        reply.message().contains("'" + retired.getName() + "' is deleted; restore it first"),
        reply.message());
  }

  @ParameterizedTest
  @ValueSource(strings = {"namesAnotherInverse", "isUsed", "isDeleted"})
  void restoringADeletedSideDropsItsInverseWhenThePartnerCannotTakeItBack(
      String partnerState, TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType deleted = pair.getFirst();
    RelationshipType partner = pair.getLast();
    assertEquals(200, deleteType(deleted.getId(), false).status());
    UUID from = createTerm(glossary, ns.shortPrefix("from"));
    UUID to = createTerm(glossary, ns.shortPrefix("to"));
    switch (partnerState) {
      case "namesAnotherInverse" -> {
        RelationshipType other = createType(relationTypeName(ns, "other"), null);
        assertEquals(200, putType(typeRequest(partner.getName(), other.getName())).status());
      }
      case "isUsed" -> assertEquals(200, relate(from, to, partner.getName()).status());
      default -> assertEquals(200, deleteType(partner.getId(), false).status());
    }
    String partnerInverse = inverseOf(partner.getId());
    List<String> partnerReads = relationTypesTowards(from, to);

    Reply reply = restoreType(deleted.getId());

    assertEquals(200, reply.status(), reply.message());
    assertNull(reply.body().path("inverse").path("fullyQualifiedName").asText(null));
    assertNull(inverseOf(deleted.getId()));
    assertEquals(partnerInverse, inverseOf(partner.getId()));
    assertEquals(partnerReads, relationTypesTowards(from, to));
    assertAllSucceed(relationReads(glossary, from, to));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aSymmetricTypesOwnInverseNeverBlocksItsDelete(boolean hardDelete, TestNamespace ns) {
    ObjectNode request = typeRequest(relationTypeName(ns, "adjacentTo"), null);
    request.putArray("characteristics").add("SYMMETRIC");
    RelationshipType symmetric = asType(putType(request));
    assertEquals(symmetric.getName(), inverseOf(symmetric.getId()));

    assertEquals(200, deleteType(symmetric.getId(), hardDelete).status());
    if (!hardDelete) {
      assertEquals(200, restoreType(symmetric.getId()).status());
      assertEquals(symmetric.getName(), inverseOf(symmetric.getId()));
    }
  }

  @Test
  void bothSidesOfAnUnusedPairCanBeDeletedInTurn(TestNamespace ns) {
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));

    assertEquals(200, deleteType(pair.getFirst().getId(), false).status());
    assertEquals(200, deleteType(pair.getLast().getId(), false).status());
    assertEquals(200, deleteType(pair.getLast().getId(), true).status());
    assertEquals(200, deleteType(pair.getFirst().getId(), true).status());
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

    assertRejectedAsInUse(reply, "glossary term relation");
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
    try {
      assertEquals(200, putSettings(withLegacyTypes(original, pair(first, second))).status());
      RelationshipType referrer =
          asType(
              putType(
                  typeRequest(relationTypeName(ns, "outsider"), null).put("replacedBy", first)));

      Reply refused = putSettings(original);

      assertRejectedAsInUse(refused, "'" + referrer.getName() + "' (replacedBy)");
      assertTrue(settingsRelationTypes().toString().contains(first), "the setting was not saved");
      assertLive(asType(getTypeByName(first)));

      assertEquals(200, deleteType(referrer.getId(), true).status());
      ObjectNode forwardReference = typeRequest(second, first).put("replacedBy", "notYet" + second);
      assertEquals(200, putType(forwardReference).status());
      assertEquals(200, putSettings(original).status());
      assertEquals(404, getTypeByName(first).status());
      assertEquals(404, getTypeByName(second).status());
    } finally {
      putSettings(original);
    }
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void theDeprecatedSettingsWriteClearsAnOutsideTypesBackLinkToARemovedType(TestNamespace ns) {
    String removed = relationTypeName(ns, "legacyMentors");
    JsonNode original = settingsRelationTypes();
    try {
      assertEquals(
          200, putSettings(withLegacyTypes(original, List.of(legacyType(removed, null)))).status());
      RelationshipType outsider = createType(relationTypeName(ns, "outsider"), removed);

      Reply reply = putSettings(original);

      assertEquals(200, reply.status(), reply.message());
      assertEquals(404, getTypeByName(removed).status());
      assertLive(outsider);
      assertNull(inverseOf(outsider.getId()));
    } finally {
      putSettings(original);
    }
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void theDeprecatedSettingsWriteMayDropOneSideOfAPairWhileClearingTheOthersInverse(
      TestNamespace ns) {
    String first = relationTypeName(ns, "legacyCauses");
    String second = relationTypeName(ns, "legacyCausedBy");
    JsonNode original = settingsRelationTypes();
    try {
      assertEquals(200, putSettings(withLegacyTypes(original, pair(first, second))).status());

      Reply reply = putSettings(withLegacyTypes(original, List.of(legacyType(first, null))));

      assertEquals(200, reply.status(), reply.message());
      assertEquals(404, getTypeByName(second).status());
      RelationshipType kept = asType(getTypeByName(first));
      assertLive(kept);
      assertNull(inverseOf(kept.getId()));
    } finally {
      putSettings(original);
    }
  }

  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void theDeprecatedSettingsWriteBringsBackAListedSoftDeletedTypeBeforeAnotherNamesIt(
      TestNamespace ns) {
    String first = relationTypeName(ns, "legacyOwns");
    String second = relationTypeName(ns, "legacyOwnedBy");
    JsonNode original = settingsRelationTypes();
    try {
      assertEquals(
          200, putSettings(withLegacyTypes(original, List.of(legacyType(second, null)))).status());
      RelationshipType deleted = asType(getTypeByName(second));
      assertEquals(200, deleteType(deleted.getId(), false).status());

      Reply reply =
          putSettings(
              withLegacyTypes(
                  original, List.of(legacyType(first, second), legacyType(second, null))));

      assertEquals(200, reply.status(), reply.message());
      assertLive(deleted);
      assertLive(asType(getTypeByName(first)));
    } finally {
      putSettings(original);
    }
  }

  @Test
  void namesThatDifferOnlyInCaseNeverCountEachOthersRelations(TestNamespace ns) {
    String name = relationTypeName(ns, "cites");
    RelationshipType lower = createType(name, null);
    RelationshipType upper =
        createType(Character.toUpperCase(name.charAt(0)) + name.substring(1), null);
    UUID paper = createTerm(glossary, ns.shortPrefix("paper"));
    UUID source = createTerm(glossary, ns.shortPrefix("source"));
    assertEquals(200, relate(paper, source, lower.getName()).status());

    assertEquals(200, deleteType(upper.getId(), true).status());
    assertRejectedAsInUse(deleteType(lower.getId(), true), "used by 1 glossary term relation");
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
    String ownerName = relationTypeName(ns, "owner");
    RelationshipType owner =
        asType(putType(typeRequest(ownerName, null).put("replacedBy", target.getName())));
    assertEquals(200, deleteType(owner.getId(), false).status());

    assertRejectedAsInUse(
        deleteType(target.getId(), true), "'" + ownerName + "' (replacedBy, soft-deleted)");

    assertEquals(200, deleteType(owner.getId(), true).status());
    assertEquals(200, deleteType(target.getId(), true).status());
  }

  @Test
  void aSoftDeletedTypesBackLinkDoesNotBlockAndItsRestoreDropsIt(TestNamespace ns) {
    RelationshipType target = createType(relationTypeName(ns, "target"), null);
    RelationshipType owner = createType(relationTypeName(ns, "owner"), target.getName());
    assertEquals(200, deleteType(owner.getId(), false).status());

    assertEquals(200, deleteType(target.getId(), true).status());

    assertEquals(200, restoreType(owner.getId()).status());
    assertNull(inverseOf(owner.getId()));
    assertAllSucceed(relationReads(glossary));
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

  /** Which fields the type's stored inverse reference carries. */
  private static List<String> inverseShape(RelationshipType type) {
    List<String> fields = new ArrayList<>();
    getType(type.getId()).body().path("inverse").fieldNames().forEachRemaining(fields::add);
    return fields.stream().sorted().toList();
  }

  /**
   * Relates two new terms with the pair's first type, authored from the higher and from the lower
   * term id, and returns what each end reads, with type names replaced by their role in the pair.
   */
  private List<String> readsFromBothEnds(
      TestNamespace ns, List<RelationshipType> pair, String tag) {
    List<String> reads = new ArrayList<>();
    for (boolean fromHigher : List.of(true, false)) {
      UUID one = createTerm(glossary, ns.shortPrefix(tag + fromHigher + "one"));
      UUID two = createTerm(glossary, ns.shortPrefix(tag + fromHigher + "two"));
      UUID lower = one.compareTo(two) < 0 ? one : two;
      UUID higher = one.compareTo(two) < 0 ? two : one;
      UUID from = fromHigher ? higher : lower;
      UUID to = fromHigher ? lower : higher;
      assertEquals(200, relate(from, to, pair.getFirst().getName()).status());
      reads.add(
          roles(relationTypesTowards(from, to), pair)
              + "/"
              + roles(relationTypesTowards(to, from), pair));
    }
    return reads;
  }

  private static String roles(List<String> types, List<RelationshipType> pair) {
    return types.stream()
        .map(
            type ->
                type.equals(pair.getFirst().getName())
                    ? "first"
                    : type.equals(pair.getLast().getName()) ? "second" : type)
        .toList()
        .toString();
  }

  private static JsonNode settingsRelationTypes() {
    Reply reply = send("GET", SETTINGS + "/glossaryTermRelationSettings", null);
    assertEquals(200, reply.status(), reply.message());
    return reply.body().path("config_value").path("relationTypes");
  }

  private static List<ObjectNode> pair(String first, String second) {
    return List.of(legacyType(first, second), legacyType(second, first));
  }

  private static ArrayNode withLegacyTypes(JsonNode relationTypes, List<ObjectNode> added) {
    ArrayNode updated = ((ArrayNode) relationTypes).deepCopy();
    added.forEach(updated::add);
    return updated;
  }

  private static ObjectNode legacyType(String name, String inverse) {
    ObjectNode type =
        MAPPER
            .createObjectNode()
            .put("name", name)
            .put("displayName", name)
            .put("description", "Legacy relation type " + name)
            .put("category", "associative")
            .put("isSystemDefined", false)
            .put("color", "#6941c6");
    if (inverse != null) {
      type.put("inverseRelation", inverse);
    }
    return type;
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
