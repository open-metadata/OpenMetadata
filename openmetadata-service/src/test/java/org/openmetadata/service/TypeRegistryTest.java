/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.networknt.schema.Schema;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Tests {@link TypeRegistry#getPropertyName(String)} and the self-healing custom-property lookup.
 *
 * <p>The OpenMetadata FQN system normalises quotes — a property named {@code "/random/"} (with
 * literal quote characters) and a property named {@code custom.test} (with dots) end up with FQN
 * segments that look the same after normalisation. To return the original name to API consumers,
 * {@code getPropertyName} prefers the registered {@link CustomProperty#getName()} over re-deriving
 * from the FQN. These tests pin that behaviour.
 *
 * <p>The remaining tests cover the multi-replica self-heal: a custom property created on a peer
 * replica is absent from this process's registry, so a cache miss re-reads the owning type from the
 * shared database, while a negative cache bounds repeated reads for genuinely-unknown fields.
 */
class TypeRegistryTest {

  private static final String ENTITY_TYPE = "table";
  private static final String FQN_PREFIX_TABLE = "table.customProperties";

  private static final String STRING_TYPE = "string";

  @AfterEach
  void cleanRegistry() {
    TypeRegistry.CUSTOM_PROPERTIES.clear();
    TypeRegistry.CUSTOM_PROPERTY_SCHEMAS.clear();
    TypeRegistry.TYPES.clear();
    TypeRegistry.TYPE_UPDATED_AT.clear();
    TypeRegistry.MISSING_CUSTOM_PROPERTIES.invalidateAll();
    TypeRegistry.RECENTLY_REFRESHED_TYPES.invalidateAll();
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();
    Entity.setTypeRepository(null);
  }

  /**
   * Multi-replica desync of the {@code TYPES} map: a custom property type created on a peer replica
   * (e.g. via {@code POST /metadata/types} with {@code category=field}) is absent from this
   * process's registry. Validating a custom property that references it must self-heal by re-reading
   * the type from the shared database instead of rejecting the property as an unknown type.
   */
  @Test
  void validateCustomProperties_selfHealsMissingPropertyTypeFromDatabase() {
    String fieldType = "currency";
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getByName(any(), eq(fieldType), any()))
        .thenReturn(
            new Type()
                .withName(fieldType)
                .withCategory(Category.Field)
                .withSchema("{\"type\":\"string\"}"));
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().validateCustomProperties(tableTypeUsingPropertyType(fieldType));

    assertNotNull(
        TypeRegistry.TYPES.get(fieldType),
        "Missing property type should be self-healed from the database");
  }

  /**
   * When the referenced property type is genuinely absent — not in the registry and not in the
   * database — validation must still reject it after the self-heal attempt.
   */
  @Test
  void validateCustomProperties_throwsWhenPropertyTypeAbsentEvenAfterReload() {
    String fieldType = "ghostType";
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getByName(any(), eq(fieldType), any()))
        .thenThrow(new RuntimeException("type not found"));
    Entity.setTypeRepository(repository);

    Type tableType = tableTypeUsingPropertyType(fieldType);
    assertThrows(
        EntityNotFoundException.class,
        () -> TypeRegistry.instance().validateCustomProperties(tableType));
  }

  private static Type tableTypeUsingPropertyType(String propertyTypeName) {
    return new Type()
        .withName(ENTITY_TYPE)
        .withCategory(Category.Entity)
        .withCustomProperties(
            List.of(
                new CustomProperty()
                    .withName("price")
                    .withPropertyType(new EntityReference().withName(propertyTypeName))));
  }

  /**
   * Simulates the multi-replica desync: a custom property created on a peer replica exists in the
   * shared database but is absent from this process's registry. A cache miss must self-heal by
   * re-reading the owning type from the database so the property resolves instead of surfacing as
   * an unknown field.
   */
  @Test
  void getSchema_selfHealsFromDatabaseOnCacheMiss() {
    seedBasePropertyType();
    String propertyName = "relationships";
    repositoryReturningTableWith(propertyName);

    String fqn = TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, propertyName);
    assertNull(
        TypeRegistry.CUSTOM_PROPERTY_SCHEMAS.get(fqn),
        "Precondition: stale replica does not know the custom property");

    Schema schema = TypeRegistry.instance().getSchema(ENTITY_TYPE, propertyName);

    assertNotNull(schema, "Schema should be self-healed from the database on a cache miss");
  }

  /**
   * A burst of misses for distinct unknown fields of the same type must reuse one database reload
   * rather than one round-trip per field (read-amplification / thundering-herd guard).
   */
  @Test
  void getSchema_coalescesDatabaseReadsAcrossDistinctUnknownFields() {
    seedBasePropertyType();
    TypeRepository repository = repositoryReturningTableWith("knownProp");

    assertNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "unknownA"));
    assertNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "unknownB"));
    assertNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "unknownC"));

    verify(repository, times(1)).getByName(any(), eq(ENTITY_TYPE), any());
  }

  /**
   * The negative cache must stop a genuinely-unknown field from re-reading the database on every
   * request. The coalescing window is cleared between calls so this asserts the negative cache
   * itself bounds the reads, not the short-lived per-type refresh window.
   */
  @Test
  void getSchema_negativeCacheStopsRepeatedDbReadsForUnknownField() {
    seedBasePropertyType();
    TypeRepository repository = repositoryReturningTableWith("knownProp");

    assertNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "ghost"));
    TypeRegistry.RECENTLY_REFRESHED_TYPES.invalidateAll();
    assertNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "ghost"));

    verify(repository, times(1)).getByName(any(), eq(ENTITY_TYPE), any());
  }

  /**
   * Creating a property locally must drop any prior negative-cache entry for it, so a field that
   * was reported unknown before it existed resolves immediately on create-then-use.
   */
  @Test
  void addCustomProperty_clearsNegativeCacheEntryOnCreate() {
    seedBasePropertyType();
    String fqn = TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, "fresh");
    TypeRegistry.MISSING_CUSTOM_PROPERTIES.put(fqn, Boolean.TRUE);

    TypeRegistry.instance().addType(tableTypeWith("fresh"));

    assertNull(
        TypeRegistry.MISSING_CUSTOM_PROPERTIES.getIfPresent(fqn),
        "Creating the property must clear its negative-cache entry");
    assertNotNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "fresh"));
  }

  /**
   * A transient database failure during the self-heal reload must neither pin an existing property
   * as unknown nor occupy the coalescing window: the field is left out of the negative cache and
   * the very next lookup retries the database immediately (no manual window clearing here).
   */
  @Test
  void getSchema_retriesImmediatelyAndDoesNotPinPropertyWhenReloadFails() {
    seedBasePropertyType();
    String propertyName = "relationships";
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getByName(any(), eq(ENTITY_TYPE), any()))
        .thenThrow(new RuntimeException("transient database error"))
        .thenReturn(tableTypeWith(propertyName));
    Entity.setTypeRepository(repository);

    assertNull(
        TypeRegistry.instance().getSchema(ENTITY_TYPE, propertyName),
        "Failed reload returns no schema for this attempt");

    assertNotNull(
        TypeRegistry.instance().getSchema(ENTITY_TYPE, propertyName),
        "Next lookup must retry the database immediately, not wait out the coalescing window");
  }

  /**
   * A custom property deleted on a peer replica is a cache hit locally, so the miss-heal never
   * re-reads it. The version check must notice the owning type's {@code updatedAt} advanced, evict
   * the type's cached properties, and reload — dropping the deleted property.
   */
  @Test
  void getSchema_dropsDeletedPropertyWhenTypeUpdatedAtAdvanced() {
    seedBasePropertyType();
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(ENTITY_TYPE)).thenReturn(200L);
    when(repository.getByName(any(), eq(ENTITY_TYPE), any())).thenReturn(tableTypeWith(null, 200L));
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(tableTypeWith("gone", 100L));
    assertNotNull(
        TypeRegistry.CUSTOM_PROPERTY_SCHEMAS.get(
            TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, "gone")),
        "Precondition: stale replica still has the deleted property cached");
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    assertNull(
        TypeRegistry.instance().getSchema(ENTITY_TYPE, "gone"),
        "A property deleted on a peer must be dropped once the version check reloads the type");
  }

  /**
   * An edit to a property's config on a peer (e.g. enum values changed) is a cache hit locally. The
   * version check must reload the type so the fresh config replaces the stale one.
   */
  @Test
  void getCustomPropertyConfig_refreshesEditedConfigWhenTypeUpdatedAtAdvanced() {
    seedBasePropertyType();
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(ENTITY_TYPE)).thenReturn(200L);
    when(repository.getByName(any(), eq(ENTITY_TYPE), any()))
        .thenReturn(tableTypeWithConfig("size", "new", 200L));
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(tableTypeWithConfig("size", "old", 100L));
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    assertEquals(
        "new",
        TypeRegistry.getCustomPropertyConfig(ENTITY_TYPE, "size"),
        "An edited config must be refreshed from the database on the version check");
  }

  /** An unchanged {@code updatedAt} must serve the cached hit without reloading the type. */
  @Test
  void getSchema_servesCachedHitWithoutReloadWhenUnchanged() {
    seedBasePropertyType();
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(ENTITY_TYPE)).thenReturn(100L);
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(tableTypeWith("stable", 100L));
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    assertNotNull(TypeRegistry.instance().getSchema(ENTITY_TYPE, "stable"));
    verify(repository, times(0)).getByName(any(), eq(ENTITY_TYPE), any());
  }

  /** Repeated reads within the window issue a single {@code updatedAt} check (coalescing). */
  @Test
  void getSchema_coalescesVersionChecksWithinWindow() {
    seedBasePropertyType();
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(ENTITY_TYPE)).thenReturn(100L);
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(tableTypeWith("stable", 100L));
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    TypeRegistry.instance().getSchema(ENTITY_TYPE, "stable");
    TypeRegistry.instance().getSchema(ENTITY_TYPE, "stable");

    verify(repository, times(1)).getUpdatedAt(ENTITY_TYPE);
  }

  /**
   * Column-level custom properties attach to the {@code tableColumn} type, not the parent
   * {@code table}. The version check must key on the entity type actually queried, so a column
   * property change is detected on {@code tableColumn} and never resolved against {@code table}.
   */
  @Test
  void getSchema_columnLevelChangeIsKeyedOnColumnTypeNotParent() {
    seedBasePropertyType();
    String columnType = "tableColumn";
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(columnType)).thenReturn(200L);
    when(repository.getByName(any(), eq(columnType), any()))
        .thenReturn(typeWith(columnType, null, 200L));
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(typeWith(columnType, "colProp", 100L));
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    assertNull(
        TypeRegistry.instance().getSchema(columnType, "colProp"),
        "A deleted column custom property must drop after reload keyed on tableColumn");
    verify(repository, times(0)).getUpdatedAt(ENTITY_TYPE);
  }

  /** A transient database failure during the version check must serve the last-known cached hit. */
  @Test
  void getSchema_dbFailureOnVersionCheckServesCachedHit() {
    seedBasePropertyType();
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getUpdatedAt(ENTITY_TYPE)).thenThrow(new RuntimeException("db blip"));
    Entity.setTypeRepository(repository);

    TypeRegistry.instance().addType(tableTypeWith("stable", 100L));
    TypeRegistry.RECENTLY_VERSION_CHECKED_TYPES.invalidateAll();

    assertNotNull(
        TypeRegistry.instance().getSchema(ENTITY_TYPE, "stable"),
        "A transient DB failure on the version check serves the last-known cached schema");
  }

  private void seedBasePropertyType() {
    TypeRegistry.TYPES.put(
        STRING_TYPE, new Type().withName(STRING_TYPE).withSchema("{\"type\":\"string\"}"));
  }

  private Type tableTypeWith(String propertyName) {
    return new Type()
        .withName(ENTITY_TYPE)
        .withCategory(Category.Entity)
        .withCustomProperties(
            List.of(
                new CustomProperty()
                    .withName(propertyName)
                    .withPropertyType(new EntityReference().withName(STRING_TYPE))));
  }

  private Type tableTypeWith(String propertyName, Long updatedAt) {
    return typeWith(ENTITY_TYPE, propertyName, updatedAt);
  }

  private Type typeWith(String typeName, String propertyName, Long updatedAt) {
    Type type =
        new Type().withName(typeName).withCategory(Category.Entity).withUpdatedAt(updatedAt);
    if (propertyName == null) {
      type.withCustomProperties(List.of());
    } else {
      type.withCustomProperties(
          List.of(
              new CustomProperty()
                  .withName(propertyName)
                  .withPropertyType(new EntityReference().withName(STRING_TYPE))));
    }
    return type;
  }

  private Type tableTypeWithConfig(String propertyName, String config, Long updatedAt) {
    return new Type()
        .withName(ENTITY_TYPE)
        .withCategory(Category.Entity)
        .withUpdatedAt(updatedAt)
        .withCustomProperties(
            List.of(
                new CustomProperty()
                    .withName(propertyName)
                    .withPropertyType(new EntityReference().withName(STRING_TYPE))
                    .withCustomPropertyConfig(new CustomPropertyConfig().withConfig(config))));
  }

  private TypeRepository repositoryReturningTableWith(String propertyName) {
    TypeRepository repository = mock(TypeRepository.class);
    when(repository.getFields(any())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    when(repository.getByName(any(), eq(ENTITY_TYPE), any()))
        .thenReturn(tableTypeWith(propertyName));
    Entity.setTypeRepository(repository);
    return repository;
  }

  @Test
  void getPropertyName_returnsRegisteredNameWithLiteralQuotesPreserved() {
    // Property name has literal quote characters that the FQN system would
    // otherwise strip during quoteName() normalisation.
    String propertyName = "\"/random/\"";
    String fqn = TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, propertyName);
    TypeRegistry.CUSTOM_PROPERTIES.put(fqn, customPropertyNamed(propertyName));

    // Sanity: FQN-level normalisation strips the literal quotes — there is no
    // way to recover them by parsing the FQN segment alone.
    assertEquals(FQN_PREFIX_TABLE + "./random/", fqn);

    assertEquals(propertyName, TypeRegistry.getPropertyName(fqn));
  }

  @Test
  void getPropertyName_returnsRegisteredNameForPropertyWithDots() {
    String propertyName = "custom.test";
    String fqn = TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, propertyName);
    TypeRegistry.CUSTOM_PROPERTIES.put(fqn, customPropertyNamed(propertyName));

    // FQN-quoting wraps names containing dots so the FQN parser can split them.
    assertEquals(FQN_PREFIX_TABLE + ".\"custom.test\"", fqn);

    // The returned name is the original (unquoted) form, not the FQN-quoted one.
    assertEquals(propertyName, TypeRegistry.getPropertyName(fqn));
  }

  @Test
  void getPropertyName_returnsRegisteredNameForSimpleProperty() {
    String propertyName = "demo";
    String fqn = TypeRegistry.getCustomPropertyFQN(ENTITY_TYPE, propertyName);
    TypeRegistry.CUSTOM_PROPERTIES.put(fqn, customPropertyNamed(propertyName));

    assertEquals(FQN_PREFIX_TABLE + ".demo", fqn);
    assertEquals(propertyName, TypeRegistry.getPropertyName(fqn));
  }

  @Test
  void getPropertyName_fallsBackToFqnParsingWhenNotRegistered() {
    // Unregistered property with FQN-quoted segment (i.e., name had dots).
    // Without a registry hit, we must fall back to FQN parsing + unquoteName.
    String fqn = FQN_PREFIX_TABLE + ".\"custom.test\"";

    assertEquals("custom.test", TypeRegistry.getPropertyName(fqn));
  }

  @Test
  void getPropertyName_fallsBackToFqnParsingForUnquotedSegment() {
    String fqn = FQN_PREFIX_TABLE + ".demo";

    assertEquals("demo", TypeRegistry.getPropertyName(fqn));
  }

  @Test
  void getPropertyName_registeredNameWinsOverFqnFallback() {
    // The FQN segment is "/random/" (no quotes — they were stripped during
    // FQN building). The registered name has literal quotes. Without the
    // registry lookup, the fallback would return "/random/" and we'd lose
    // the original quotes — which is exactly the bug this fix addresses.
    String registeredName = "\"/random/\"";
    String fqn = FQN_PREFIX_TABLE + "./random/";
    TypeRegistry.CUSTOM_PROPERTIES.put(fqn, customPropertyNamed(registeredName));

    assertEquals(registeredName, TypeRegistry.getPropertyName(fqn));
  }

  private static CustomProperty customPropertyNamed(String name) {
    return new CustomProperty().withName(name);
  }
}
