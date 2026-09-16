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

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Objects;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.openmetadata.service.Entity;

/** Validates entity types before they are interpolated into RDF identifiers or queries. */
public final class RdfEntityTypeValidator {

  private static final Pattern ENTITY_TYPE = Pattern.compile("[A-Za-z][A-Za-z0-9]*");

  private RdfEntityTypeValidator() {}

  public static String requireKnown(String entityType) {
    return requireKnown(entityType, Entity::hasEntityRepository);
  }

  static String requireKnown(String entityType, Predicate<String> knownEntityType) {
    String validated = validateSyntax(entityType);
    if (!Objects.requireNonNull(knownEntityType).test(validated)) {
      throw new IllegalArgumentException("Invalid entity type");
    }
    return validated;
  }

  static String validateSyntax(String entityType) {
    if (nullOrEmpty(entityType) || entityType.isBlank()) {
      throw new IllegalArgumentException("Entity type is required");
    }
    String validated = entityType.trim();
    if (!ENTITY_TYPE.matcher(validated).matches()) {
      throw new IllegalArgumentException("Invalid entity type");
    }
    return validated;
  }
}
