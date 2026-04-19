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

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.type.CustomProperty;

/**
 * Tests {@link TypeRegistry#getPropertyName(String)}.
 *
 * <p>The OpenMetadata FQN system normalises quotes — a property named {@code "/random/"} (with
 * literal quote characters) and a property named {@code custom.test} (with dots) end up with FQN
 * segments that look the same after normalisation. To return the original name to API consumers,
 * {@code getPropertyName} prefers the registered {@link CustomProperty#getName()} over re-deriving
 * from the FQN. These tests pin that behaviour.
 */
class TypeRegistryTest {

  private static final String ENTITY_TYPE = "table";
  private static final String FQN_PREFIX_TABLE = "table.customProperties";

  @AfterEach
  void cleanRegistry() {
    TypeRegistry.CUSTOM_PROPERTIES.clear();
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
