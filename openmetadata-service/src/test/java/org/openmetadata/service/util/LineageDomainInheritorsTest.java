package org.openmetadata.service.util;

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
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.indexes.LineageIndex;
import org.openmetadata.service.util.LineageDomainRollups.DomainMove;

/** Against the shipped index mapping and search index classes, the two sources production reads. */
class LineageDomainInheritorsTest {

  private static final Map<String, List<String>> CHILD_ALIASES = childAliases();
  private static final SearchIndexFactory INDEXES = new SearchIndexFactory();
  private static final EntityReference D1 = reference(Entity.DOMAIN);
  private static final EntityReference X = reference(Entity.DOMAIN);

  static Stream<Arguments> containers() {
    Set<String> databaseAssets = Set.of(Entity.TABLE, Entity.STORED_PROCEDURE);
    Set<String> driveAssets =
        Set.of(Entity.DIRECTORY, Entity.FILE, Entity.SPREADSHEET, Entity.WORKSHEET);
    return Stream.of(
        arguments(Entity.DATABASE_SERVICE, databaseAssets),
        arguments(Entity.DATABASE, databaseAssets),
        arguments(Entity.DATABASE_SCHEMA, databaseAssets),
        arguments(Entity.TABLE, Set.of()),
        arguments(Entity.STORAGE_SERVICE, Set.of(Entity.CONTAINER)),
        arguments(Entity.CONTAINER, Set.of()),
        arguments(Entity.DRIVE_SERVICE, driveAssets),
        arguments(Entity.DIRECTORY, driveAssets),
        arguments(Entity.SPREADSHEET, Set.of(Entity.WORKSHEET)),
        arguments(
            Entity.DASHBOARD_SERVICE,
            Set.of(Entity.DASHBOARD, Entity.DASHBOARD_DATA_MODEL, Entity.CHART)),
        arguments(Entity.API_SERVICE, Set.of(Entity.API_ENDPOINT)),
        arguments(Entity.API_COLLECTION, Set.of(Entity.API_ENDPOINT)),
        arguments(Entity.GLOSSARY, Set.of()));
  }

  @ParameterizedTest
  @MethodSource("containers")
  void aContainersInheritingTypesAreTheLineageEndsUnderIt(String container, Set<String> expected) {
    Set<String> types =
        LineageDomainInheritors.inheritingTypes(
            container,
            type -> CHILD_ALIASES.getOrDefault(type, List.of()),
            LineageDomainInheritorsTest::carriesLineage);

    assertEquals(expected, Set.copyOf(types));
  }

  @Test
  void aWriteAboveTheCapMovesNoDescendantInItsTransaction() {
    List<EntityReference> containers = List.of(reference(Entity.DATABASE_SERVICE));
    List<EntityReference> two = List.of(reference(Entity.TABLE), reference(Entity.TABLE));

    assertTrue(LineageDomainInheritors.movesInTheWrite(containers, two, 2));
    assertFalse(LineageDomainInheritors.movesInTheWrite(containers, two, 1));
    assertFalse(LineageDomainInheritors.movesInTheWrite(containers, List.of(), 2));
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

  private static boolean carriesLineage(String type) {
    boolean carries;
    try {
      carries = INDEXES.buildIndex(type, null) instanceof LineageIndex;
    } catch (IllegalArgumentException notIndexed) {
      carries = false;
    }
    return carries;
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
