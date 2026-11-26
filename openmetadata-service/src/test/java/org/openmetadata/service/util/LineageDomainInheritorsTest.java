package org.openmetadata.service.util;

import static java.util.stream.Collectors.toSet;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.LineageDomainInheritors.DescendantIds;
import org.openmetadata.service.util.LineageDomainRollups.DomainMove;

/**
 * Against the shipped index mapping, the two sources production reads. Discovery is driven by a
 * fake lookup that answers the way {@code fqnHash LIKE 'hash.%' LIMIT n} does.
 */
class LineageDomainInheritorsTest {

  private static final Map<String, List<String>> CHILD_ALIASES = childAliases();
  // A database and its schema in one write: the schema's tables sit under both prefixes.
  private static final String DATABASE_FQN = "svc.db";
  private static final String SCHEMA_FQN = "svc.db.schema";
  private static final List<String> SCHEMA_TABLES =
      List.of("svc.db.schema.t1", "svc.db.schema.t2", "svc.db.schema.t3", "svc.db.schema.t4");
  private static final List<String> SIBLING_TABLES = List.of("svc.db.other.s1", "svc.db.other.s2");
  private static final Set<String> NO_DOMAINS =
      Set.of(Entity.DOMAIN, Entity.TABLE_COLUMN, "testCaseResolutionStatus", "testCaseResult");
  private static final EntityReference D1 = reference(Entity.DOMAIN);
  private static final EntityReference X = reference(Entity.DOMAIN);

  static Stream<Arguments> containers() {
    Set<String> serviceAssets =
        Set.of(
            Entity.DATABASE,
            Entity.DATABASE_SCHEMA,
            Entity.STORED_PROCEDURE,
            Entity.TABLE,
            Entity.TEST_SUITE,
            Entity.TEST_CASE);
    Set<String> databaseAssets =
        Set.of(
            Entity.DATABASE_SCHEMA,
            Entity.STORED_PROCEDURE,
            Entity.TABLE,
            Entity.TEST_SUITE,
            Entity.TEST_CASE);
    Set<String> schemaAssets =
        Set.of(Entity.STORED_PROCEDURE, Entity.TABLE, Entity.TEST_SUITE, Entity.TEST_CASE);
    Set<String> driveAssets =
        Set.of(Entity.DIRECTORY, Entity.FILE, Entity.SPREADSHEET, Entity.WORKSHEET);
    return Stream.of(
        arguments(Entity.DATABASE_SERVICE, serviceAssets),
        arguments(Entity.DATABASE, databaseAssets),
        arguments(Entity.DATABASE_SCHEMA, schemaAssets),
        arguments(Entity.TABLE, Set.of(Entity.TEST_SUITE, Entity.TEST_CASE)),
        arguments(Entity.STORAGE_SERVICE, Set.of(Entity.CONTAINER)),
        arguments(Entity.CONTAINER, Set.of()),
        arguments(Entity.DRIVE_SERVICE, driveAssets),
        arguments(Entity.DIRECTORY, driveAssets),
        arguments(Entity.SPREADSHEET, Set.of(Entity.WORKSHEET)),
        arguments(
            Entity.DASHBOARD_SERVICE,
            Set.of(Entity.DASHBOARD, Entity.DASHBOARD_DATA_MODEL, Entity.CHART)),
        arguments(Entity.API_SERVICE, Set.of(Entity.API_COLLECTION, Entity.API_ENDPOINT)),
        arguments(Entity.API_COLLECTION, Set.of(Entity.API_ENDPOINT)),
        arguments(Entity.GLOSSARY, Set.of("glossaryTerm")));
  }

  @ParameterizedTest
  @MethodSource("containers")
  void aContainersInheritingTypesAreTheLineageEndsUnderIt(String container, Set<String> expected) {
    Set<String> types =
        LineageDomainInheritors.inheritingTypes(
            container,
            type -> CHILD_ALIASES.getOrDefault(type, List.of()),
            type -> !NO_DOMAINS.contains(type));

    assertEquals(expected, Set.copyOf(types));
  }

  @Test
  void theUnionOfOverlappingPrefixesMovesEveryDistinctEndpointWithinTheCap() {
    Map<String, UUID> tables = tables();
    List<EntityReference> containers =
        List.of(named(Entity.DATABASE, DATABASE_FQN), named(Entity.DATABASE_SCHEMA, SCHEMA_FQN));

    List<EntityReference> found =
        LineageDomainInheritors.descendantsWithLineage(
            containers, 6, type -> Set.of(Entity.TABLE), tablesUnder(tables));

    assertEquals(Set.copyOf(tables.values()), idsOf(found));
    assertEquals(6, found.size(), "each table once");
    assertTrue(
        LineageDomainInheritors.movesInTheWrite(found, 6),
        "six distinct endpoints fit a cap of six");
  }

  @Test
  void theUnionOneAboveTheCapMovesNone() {
    Map<String, UUID> tables = tables();
    List<EntityReference> containers =
        List.of(named(Entity.DATABASE, DATABASE_FQN), named(Entity.DATABASE_SCHEMA, SCHEMA_FQN));

    List<EntityReference> found =
        LineageDomainInheritors.descendantsWithLineage(
            containers, 5, type -> Set.of(Entity.TABLE), tablesUnder(tables));

    assertFalse(LineageDomainInheritors.movesInTheWrite(found, 5));
  }

  private static Map<String, UUID> tables() {
    Map<String, UUID> tables = new LinkedHashMap<>();
    SCHEMA_TABLES.forEach(fqn -> tables.put(fqn, UUID.randomUUID()));
    SIBLING_TABLES.forEach(fqn -> tables.put(fqn, UUID.randomUUID()));
    return tables;
  }

  /** The query's answer: the lineage ends under the prefix, in the order stored, at most limit. */
  private static DescendantIds tablesUnder(Map<String, UUID> tables) {
    return (type, fqn, limit) ->
        tables.entrySet().stream()
            .filter(table -> table.getKey().startsWith(fqn + "."))
            .map(Map.Entry::getValue)
            .limit(limit)
            .toList();
  }

  private static Set<UUID> idsOf(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(toSet());
  }

  private static EntityReference named(String type, String fqn) {
    return reference(type).withFullyQualifiedName(fqn);
  }

  @Test
  void aWriteAboveTheCapMovesNoDescendantInItsTransaction() {
    List<EntityReference> two = List.of(reference(Entity.TABLE), reference(Entity.TABLE));

    assertTrue(LineageDomainInheritors.movesInTheWrite(two, 2));
    assertFalse(LineageDomainInheritors.movesInTheWrite(two, 1));
    assertFalse(LineageDomainInheritors.movesInTheWrite(List.of(), 2));
  }

  /** Over the cap the write still moves its own edges, and is the one that records the drift. */
  @Test
  void aWriteOneAboveTheCapLeavesItsDescendantsAndKeepsTheCallersMoves() {
    List<EntityReference> containers =
        List.of(named(Entity.DATABASE, DATABASE_FQN), named(Entity.DATABASE_SCHEMA, SCHEMA_FQN));
    DomainMove containerMove = new DomainMove(containers.getFirst(), List.of(X), List.of(D1));

    LineageDomainInheritors inheritors =
        LineageDomainInheritors.of(
            containers, 5, type -> Set.of(Entity.TABLE), tablesUnder(tables()));

    assertTrue(inheritors.isOverCap());
    assertEquals(List.of(), inheritors.moves());
    assertEquals(List.of(containerMove), inheritors.followedBy(List.of(containerMove)));
  }

  @Test
  void aWriteAtTheCapMovesEveryDescendantAndIsNotOverIt() {
    List<EntityReference> containers =
        List.of(named(Entity.DATABASE, DATABASE_FQN), named(Entity.DATABASE_SCHEMA, SCHEMA_FQN));

    LineageDomainInheritors inheritors =
        LineageDomainInheritors.of(
            containers, 6, type -> Set.of(Entity.TABLE), tablesUnder(tables()));

    assertFalse(inheritors.isOverCap());
    assertEquals(6, inheritors.moves().size());
  }

  @Test
  void aWriteWithNoDescendantsWithLineageIsNeitherMovedNorOverTheCap() {
    LineageDomainInheritors inheritors =
        LineageDomainInheritors.of(
            List.of(named(Entity.DATABASE, DATABASE_FQN)),
            5,
            type -> Set.of(Entity.TABLE),
            (type, fqn, limit) -> List.of());

    assertFalse(inheritors.isOverCap());
    assertEquals(List.of(), inheritors.moves());
  }

  /**
   * A drive CSV batch moves parent directory P from X to D1 and clears child C's own D1, so C now
   * inherits D1: re-read, C does not move. The caller's move for C, computed before the write from
   * P's old X, must not be applied.
   */
  @Test
  void aCallerMoveOfAReReadEntityIsDroppedEvenWhenTheReadOneChangesNothing() {
    EntityReference parent = reference(Entity.DIRECTORY);
    EntityReference child = reference(Entity.DIRECTORY);
    DomainMove childRead = new DomainMove(child, List.of(D1), List.of(D1));
    DomainMove childFromCaller = new DomainMove(child, List.of(D1), List.of(X));
    DomainMove parentFromCaller = new DomainMove(parent, List.of(X), List.of(D1));

    List<DomainMove> moves =
        LineageDomainInheritors.withCallerMoves(
            List.of(childRead), List.of(childFromCaller, parentFromCaller));

    assertEquals(List.of(childRead, parentFromCaller), moves);
  }

  private static Map<String, List<String>> childAliases() {
    Map<String, List<String>> aliases = new HashMap<>();
    try (InputStream mapping =
        LineageDomainInheritorsTest.class
            .getClassLoader()
            .getResourceAsStream("elasticsearch/indexMapping.json")) {
      JsonUtils.readTree(new String(mapping.readAllBytes(), StandardCharsets.UTF_8))
          .fields()
          .forEachRemaining(entry -> aliases.put(entry.getKey(), textsOf(entry.getValue())));
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
    return aliases;
  }

  private static List<String> textsOf(JsonNode mapping) {
    List<String> children = new ArrayList<>();
    mapping.path("childAliases").forEach(alias -> children.add(alias.asText()));
    return children;
  }

  private static EntityReference reference(String type) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type);
  }
}
