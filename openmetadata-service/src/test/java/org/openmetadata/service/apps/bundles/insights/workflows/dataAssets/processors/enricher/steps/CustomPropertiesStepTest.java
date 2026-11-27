/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;

/**
 * Projection contract for {@link CustomPropertiesStep}: an entity carrying {@code extension} must
 * leave the snapshot with both DI-queryable shapes — the per-entity-type twin (Group By) and the
 * {@code customPropertiesTyped} nested structure (advanced-search filters) — and an entity with no
 * {@code extension} must gain neither. The twin leaves out values of undefined properties and values
 * whose JSON shape does not match the property's current built-in type (#36819).
 */
class CustomPropertiesStepTest {

  private static final String TEAM_PROPERTY = "teamreviewer";

  @Test
  void projectsTwinAndTypedNestedWhenExtensionPresent() {
    Map<String, Object> extension = new HashMap<>();
    extension.put("datapolicy", "purpose");
    EnrichmentTarget target = targetWith("table", extension);

    stepTyping("datapolicy", "string").apply(target);

    assertEquals(
        Map.of("datapolicy", "purpose"),
        target.entityMap().get("tableCustomProperty"),
        "the twin keeps a value of the property's type so Group By can term-query it");

    Object typed = target.entityMap().get("customPropertiesTyped");
    assertInstanceOf(List.class, typed, "customPropertiesTyped must be the nested entry list");
    List<?> entries = (List<?>) typed;
    assertEquals(1, entries.size());
    Map<?, ?> entry = (Map<?, ?>) entries.get(0);
    assertEquals("datapolicy", entry.get("name"), "the property name is the nested term key");
    assertEquals(
        "purpose", entry.get("stringValue"), "the value is carried as a keyword stringValue");
  }

  @Test
  void writesTwinButSkipsEmptyTypedWhenExtensionYieldsNoEntries() {
    Map<String, Object> extension = new HashMap<>();
    extension.put("datapolicy", null);
    EnrichmentTarget target = targetWith("table", extension);

    stepTyping("datapolicy", "string").apply(target);

    assertEquals(
        Map.of(),
        target.entityMap().get("tableCustomProperty"),
        "the twin is written but a null value has no shape to carry");
    assertFalse(
        target.entityMap().containsKey("customPropertiesTyped"),
        "no empty nested array is written when the builder yields no entries");
  }

  @Test
  void leavesSnapshotUntouchedWhenExtensionAbsent() {
    EnrichmentTarget target = targetWith("table", null);

    stepTyping("datapolicy", "string").apply(target);

    assertFalse(target.entityMap().containsKey("tableCustomProperty"), "no twin without extension");
    assertFalse(
        target.entityMap().containsKey("customPropertiesTyped"),
        "no typed nested structure without extension");
  }

  @Test
  void twinDropsLegacyStringOfTeamProperty() {
    Map<String, Object> extension = new HashMap<>();
    extension.put(TEAM_PROPERTY, "legacy-team");
    EnrichmentTarget target = targetWith("dashboard", extension);

    stepTyping(TEAM_PROPERTY, "entityReference").apply(target);

    Map<?, ?> twin = twinOf(target, "dashboard");
    assertFalse(
        twin.containsKey(TEAM_PROPERTY),
        "a 1.x string in a Team property would map the twin sub-field as text and reject every "
            + "Team object after it");
    assertSame(extension, target.entityMap().get("extension"), "the raw extension is untouched");
    assertEquals("legacy-team", extension.get(TEAM_PROPERTY));
    assertTrue(
        typedEntryNames(target).contains(TEAM_PROPERTY),
        "customPropertiesTyped still has an entry");
  }

  static Stream<Arguments> valuesMatchingTheirType() {
    return Stream.of(
        Arguments.of(
            "entityReference", Map.of("id", "4f1c", "type", "team", "fullyQualifiedName", "Data")),
        Arguments.of("entityReferenceList", List.of(Map.of("id", "9a0b", "type", "user"))),
        Arguments.of("entityReferenceList", List.of()),
        Arguments.of("timeInterval", Map.of("start", 1L, "end", 2L)),
        Arguments.of("hyperlink-cp", Map.of("url", "https://example.com", "displayText", "x")),
        Arguments.of(
            "table-cp", Map.of("columns", List.of("a"), "rows", List.of(Map.of("a", "1")))),
        Arguments.of("enum", List.of("high", "low")),
        Arguments.of("enum", "high"),
        Arguments.of("integer", 7),
        Arguments.of("number", 1.5),
        Arguments.of("timestamp", 1_700_000_000_000L),
        Arguments.of("string", "purpose"),
        Arguments.of("email", "owner@example.com"),
        Arguments.of("duration", "P1D"),
        Arguments.of("date-cp", "2026-11-16"),
        Arguments.of("dateTime-cp", "2026-11-16 10:00:00"),
        Arguments.of("time-cp", "10:00:00"),
        Arguments.of("sqlQuery", "select 1"),
        Arguments.of("markdown", "**bold**"));
  }

  @ParameterizedTest(name = "{0} keeps {1}")
  @MethodSource("valuesMatchingTheirType")
  void twinKeepsValueMatchingCurrentType(String propertyType, Object value) {
    EnrichmentTarget target = targetWith("table", new HashMap<>(Map.of("prop", value)));

    stepTyping("prop", propertyType).apply(target);

    assertSame(value, twinOf(target, "table").get("prop"), "a value of the current type is kept");
  }

  static Stream<Arguments> valuesNotMatchingTheirType() {
    return Stream.of(
        Arguments.of("entityReferenceList", List.of("legacy-user")),
        Arguments.of("enum", Map.of("value", "high")),
        Arguments.of("integer", "abc"),
        Arguments.of("string", Map.of("text", "purpose")),
        Arguments.of("timeInterval", 5),
        Arguments.of("hyperlink-cp", "http://example.com"),
        Arguments.of("table-cp", List.of()),
        Arguments.of("timestamp", "1"));
  }

  @ParameterizedTest(name = "{0} drops {1}")
  @MethodSource("valuesNotMatchingTheirType")
  void twinDropsValueNotMatchingCurrentType(String propertyType, Object value) {
    EnrichmentTarget target = targetWith("table", new HashMap<>(Map.of("prop", value)));

    stepTyping("prop", propertyType).apply(target);

    assertFalse(
        twinOf(target, "table").containsKey("prop"),
        "a value of another shape would fix the dynamic mapping against valid snapshots");
  }

  @Test
  void twinDropsValuesOfPropertiesNoLongerDefined() {
    EnrichmentTarget target = targetWith("table", new HashMap<>(Map.of("removed", "purpose")));

    new CustomPropertiesStep((entityType, name) -> Optional.empty()).apply(target);

    assertEquals(Map.of(), twinOf(target, "table"), "a deleted property has no current type");
  }

  @Test
  void twinKeepsValuesOfAUserCreatedTypeNamedUnknown() {
    EnrichmentTarget target = targetWith("table", new HashMap<>(Map.of("grade", "B")));

    stepTyping("grade", "unknown").apply(target);

    assertEquals(
        "B",
        twinOf(target, "table").get("grade"),
        "a defined property whose type is called unknown is not a missing property");
  }

  @Test
  void twinKeepsValuesOfUserCreatedFieldTypes() {
    Object amount = 12.5;
    EnrichmentTarget target = targetWith("table", new HashMap<>(Map.of("price", amount)));

    stepTyping("price", "money").apply(target);

    assertSame(
        amount, twinOf(target, "table").get("price"), "a type with no declared shape is copied");
  }

  @Test
  void everyCustomPropertyTypeHasATwinShape() {
    Set<String> fieldTypes =
        JsonUtils.getTypes().stream()
            .filter(type -> type.getCategory() == Category.Field)
            .map(Type::getName)
            .collect(Collectors.toSet());

    assertFalse(fieldTypes.isEmpty(), "the @om-field-type schemas must load");
    assertEquals(
        fieldTypes,
        CustomPropertiesStep.TWIN_SHAPE_BY_TYPE.keySet(),
        "declare the twin shape of every built-in custom-property type, or a value of another shape can type its twin sub-field");
  }

  private static CustomPropertiesStep stepTyping(String propertyName, String propertyType) {
    return new CustomPropertiesStep(
        (entityType, name) ->
            propertyName.equals(name) ? Optional.of(propertyType) : Optional.empty());
  }

  private static Map<?, ?> twinOf(EnrichmentTarget target, String entityType) {
    Object twin = target.entityMap().get(entityType + "CustomProperty");
    assertNotNull(twin, "the twin is written whenever extension is present");
    return assertInstanceOf(Map.class, twin);
  }

  private static Set<Object> typedEntryNames(EnrichmentTarget target) {
    List<?> entries = assertInstanceOf(List.class, target.entityMap().get("customPropertiesTyped"));
    return entries.stream()
        .map(entry -> ((Map<?, ?>) entry).get("name"))
        .collect(Collectors.toSet());
  }

  private static EnrichmentTarget targetWith(String entityType, Map<String, Object> extension) {
    Map<String, Object> entityMap = new HashMap<>();
    if (extension != null) {
      entityMap.put("extension", extension);
    }
    return new EnrichmentTarget(
        null,
        entityMap,
        Map.of(),
        new EnrichmentContext(entityType, List.of(), 0L, 0L),
        VersionShape.LATEST_HYDRATED);
  }
}
