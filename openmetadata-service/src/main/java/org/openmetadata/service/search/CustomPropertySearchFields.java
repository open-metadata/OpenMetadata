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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;

/**
 * Resolves an admin-configured custom-property search field (stored as {@code extension.<name>}) into
 * the nested {@code customPropertiesTyped} sub-fields that actually hold the indexed value.
 *
 * <p>The raw {@code extension} object is mapped {@code enabled:false} (stored in {@code _source},
 * never indexed) so an oversized custom-property value can never reject the whole entity document —
 * OpenSearch maps {@code extension} as {@code flat_object}, which cannot be guarded with {@code
 * ignore_above}. The searchable, engine-safe copy of every custom property lives in the {@code
 * customPropertiesTyped} nested field (property {@code name} plus a typed value), whose keyword
 * sub-fields {@link SearchIndexSettings#harden} guards with {@code ignore_above}. So a search setting
 * on {@code extension.<name>} is served at query time by a nested query over {@code
 * customPropertiesTyped} matching {@code name == <name>} and the searched value — the query builders
 * translate the configured field, the stored setting keeps the {@code extension.<name>} identifier.
 */
public final class CustomPropertySearchFields {

  public static final String CUSTOM_PROPERTIES_TYPED = "customPropertiesTyped";
  public static final String NAME_FIELD = CUSTOM_PROPERTIES_TYPED + ".name";
  public static final String TEXT_VALUE_FIELD = CUSTOM_PROPERTIES_TYPED + ".textValue";
  public static final String STRING_VALUE_FIELD = CUSTOM_PROPERTIES_TYPED + ".stringValue";

  private static final String EXTENSION_PREFIX = "extension.";
  private static final String MATCH_TYPE_EXACT = "exact";
  private static final float DEFAULT_BOOST = 1.0f;

  private CustomPropertySearchFields() {}

  /**
   * A resolved custom-property search field: the property name (the part after {@code extension.}),
   * its configured boost, and whether the admin configured an exact-match strategy.
   */
  public record Spec(String propertyName, float boost, boolean exact) {}

  /** The custom-property search fields configured on {@code assetConfig}, in configuration order. */
  public static List<Spec> from(AssetTypeConfiguration assetConfig) {
    List<Spec> specs = new ArrayList<>();
    if (assetConfig != null && assetConfig.getSearchFields() != null) {
      for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
        Spec spec = toSpec(fieldBoost);
        if (spec != null) {
          specs.add(spec);
        }
      }
    }
    return specs;
  }

  private static Spec toSpec(FieldBoost fieldBoost) {
    Spec spec = null;
    String field = fieldBoost.getField();
    if (isCustomPropertyField(field)) {
      String propertyName = field.substring(EXTENSION_PREFIX.length());
      float boost =
          fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : DEFAULT_BOOST;
      spec = new Spec(propertyName, boost, isExactMatch(fieldBoost));
    }
    return spec;
  }

  private static boolean isCustomPropertyField(String field) {
    return field != null
        && field.startsWith(EXTENSION_PREFIX)
        && field.length() > EXTENSION_PREFIX.length();
  }

  private static boolean isExactMatch(FieldBoost fieldBoost) {
    return fieldBoost.getMatchType() != null
        && MATCH_TYPE_EXACT.equals(fieldBoost.getMatchType().value());
  }
}
