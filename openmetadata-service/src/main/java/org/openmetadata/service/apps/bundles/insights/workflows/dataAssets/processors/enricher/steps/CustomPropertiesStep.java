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

import static java.util.Map.entry;
import static org.openmetadata.service.jdbi3.CustomPropertyReferences.ENTITY_REFERENCE;
import static org.openmetadata.service.jdbi3.CustomPropertyReferences.ENTITY_REFERENCE_LIST;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Predicate;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * If the entity carries an {@code extension} field, project it into the two DI-queryable shapes the
 * live data-asset index also exposes:
 *
 * <ul>
 *   <li>a per-entity-type twin (e.g. {@code tableCustomProperty}, {@code dashboardCustomProperty}),
 *       dynamically mapped so each sub-field is term-queryable — this is what Group By charts use.
 *       The first snapshot a backing index receives fixes each sub-field's type, so the twin leaves
 *       out values of properties that are no longer defined and values whose JSON shape does not
 *       match the property's current built-in type: a 1.x string left in a Team property, or a
 *       deleted property's value in a version snapshot, would otherwise get every valid snapshot
 *       rejected (ADR:2026-11-16-data-insights-custom-property-twin-holds-only-current-type-values);
 *   <li>{@code customPropertiesTyped}, the typed {@code nested} structure produced by {@link
 *       SearchIndexUtils#buildTypedCustomProperties}. The advanced-search builder emits custom-property
 *       filters as {@code nested} queries against this path, so without it those saved filters match
 *       nothing in the DI snapshot and the whole chart collapses to 0. Only written when the builder
 *       yields at least one entry — mirroring the live index, an extension that produces no typed
 *       entries adds no empty {@code nested} array.
 * </ul>
 *
 * <p>The raw {@code extension} key is intentionally left on the document unchanged — custom-property
 * search filters key off it, so removing it would break those filters.
 */
public final class CustomPropertiesStep implements EnrichmentStep {

  public static final String NAME = "customProperties";

  private static final String CUSTOM_PROPERTY_TWIN_SUFFIX = "CustomProperty";
  private static final String CUSTOM_PROPERTIES_TYPED_KEY = "customPropertiesTyped";
  private static final String EXTENSION_KEY = "extension";

  private static final Predicate<Object> IS_OBJECT = Map.class::isInstance;
  private static final Predicate<Object> IS_TEXT = String.class::isInstance;
  private static final Predicate<Object> IS_NUMBER = Number.class::isInstance;
  private static final Predicate<Object> IS_OBJECT_LIST = value -> isListOf(value, IS_OBJECT);
  private static final Predicate<Object> IS_TEXT_OR_TEXT_LIST =
      IS_TEXT.or(value -> isListOf(value, IS_TEXT));
  private static final Predicate<Object> ANY_SHAPE = value -> true;

  /** The twin shape of every built-in {@code @om-field-type}. */
  static final Map<String, Predicate<Object>> TWIN_SHAPE_BY_TYPE =
      Map.ofEntries(
          entry(ENTITY_REFERENCE, IS_OBJECT),
          entry(ENTITY_REFERENCE_LIST, IS_OBJECT_LIST),
          entry("timeInterval", IS_OBJECT),
          entry("hyperlink-cp", IS_OBJECT),
          entry("table-cp", IS_OBJECT),
          entry("enum", IS_TEXT_OR_TEXT_LIST),
          entry("integer", IS_NUMBER),
          entry("number", IS_NUMBER),
          entry("timestamp", IS_NUMBER),
          entry("string", IS_TEXT),
          entry("email", IS_TEXT),
          entry("duration", IS_TEXT),
          entry("date-cp", IS_TEXT),
          entry("dateTime-cp", IS_TEXT),
          entry("time-cp", IS_TEXT),
          entry("sqlQuery", IS_TEXT),
          entry("markdown", IS_TEXT));

  private final BiFunction<String, String, Optional<String>> propertyTypeLookup;

  public CustomPropertiesStep() {
    this(SearchIndexUtils::findPropertyType);
  }

  CustomPropertiesStep(final BiFunction<String, String, Optional<String>> propertyTypeLookup) {
    this.propertyTypeLookup = propertyTypeLookup;
  }

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    if (target.entityMap().get(EXTENSION_KEY) instanceof Map<?, ?> customProperties) {
      String entityType = target.context().entityType();
      target
          .entityMap()
          .put(entityType + CUSTOM_PROPERTY_TWIN_SUFFIX, twinValues(customProperties, entityType));
      List<Map<String, Object>> typedProperties =
          SearchIndexUtils.buildTypedCustomProperties(customProperties, entityType);
      if (!typedProperties.isEmpty()) {
        target.entityMap().put(CUSTOM_PROPERTIES_TYPED_KEY, typedProperties);
      }
    }
  }

  private Map<String, Object> twinValues(Map<?, ?> customProperties, String entityType) {
    Map<String, Object> twin = new LinkedHashMap<>();
    customProperties.forEach(
        (name, value) -> {
          String propertyName = name.toString();
          if (belongsInTwin(entityType, propertyName, value)) {
            twin.put(propertyName, value);
          }
        });
    return twin;
  }

  private boolean belongsInTwin(
      final String entityType, final String propertyName, final Object value) {
    // A property that is no longer defined has no type. User-created field types have no declared
    // shape, so their values are copied as before.
    return propertyTypeLookup
        .apply(entityType, propertyName)
        .map(propertyType -> TWIN_SHAPE_BY_TYPE.getOrDefault(propertyType, ANY_SHAPE).test(value))
        .orElse(false);
  }

  private static boolean isListOf(Object value, Predicate<Object> elementShape) {
    return value instanceof List<?> values && values.stream().allMatch(elementShape);
  }
}
