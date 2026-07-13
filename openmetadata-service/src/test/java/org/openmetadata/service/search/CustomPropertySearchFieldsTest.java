/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;

class CustomPropertySearchFieldsTest {

  private static AssetTypeConfiguration config(FieldBoost... fields) {
    return new AssetTypeConfiguration().withSearchFields(List.of(fields));
  }

  private static FieldBoost field(String name, Double boost, FieldBoost.MatchType matchType) {
    return new FieldBoost().withField(name).withBoost(boost).withMatchType(matchType);
  }

  @Test
  void resolvesExtensionFieldToNameBoostAndStandardMatch() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(field("extension.reviewer", 20.0, FieldBoost.MatchType.STANDARD)));

    assertEquals(1, specs.size());
    assertEquals("reviewer", specs.getFirst().propertyName());
    assertEquals(20.0f, specs.getFirst().boost());
    assertFalse(specs.getFirst().exact());
  }

  @Test
  void marksExactMatchTypeAsExact() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(field("extension.code", 1.0, FieldBoost.MatchType.EXACT)));

    assertTrue(specs.getFirst().exact());
  }

  @Test
  void ignoresNonExtensionFields() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(
                field("name", 10.0, FieldBoost.MatchType.STANDARD),
                field("description", 2.0, FieldBoost.MatchType.STANDARD)));

    assertTrue(specs.isEmpty());
  }

  @Test
  void ignoresBareExtensionPrefixWithoutPropertyName() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(field("extension.", 1.0, FieldBoost.MatchType.STANDARD)));

    assertTrue(specs.isEmpty());
  }

  @Test
  void keepsDottedPropertyNameAfterPrefix() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(field("extension.team.lead", 1.0, FieldBoost.MatchType.STANDARD)));

    assertEquals("team.lead", specs.getFirst().propertyName());
  }

  @Test
  void defaultsBoostToOneWhenUnset() {
    List<CustomPropertySearchFields.Spec> specs =
        CustomPropertySearchFields.from(
            config(field("extension.reviewer", null, FieldBoost.MatchType.STANDARD)));

    assertEquals(1.0f, specs.getFirst().boost());
  }

  @Test
  void returnsEmptyForNullConfigOrFields() {
    assertTrue(CustomPropertySearchFields.from(null).isEmpty());
    assertTrue(CustomPropertySearchFields.from(new AssetTypeConfiguration()).isEmpty());
  }
}
