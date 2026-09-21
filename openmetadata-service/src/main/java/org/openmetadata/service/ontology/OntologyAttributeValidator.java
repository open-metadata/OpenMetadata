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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;

public final class OntologyAttributeValidator {
  private OntologyAttributeValidator() {}

  public static List<OntologyAttribute> validate(final List<OntologyAttribute> attributes) {
    final List<OntologyAttribute> validated = List.copyOf(listOrEmpty(attributes));
    final AttributeKeys keys = new AttributeKeys();
    validated.forEach(attribute -> validateAttribute(attribute, keys));
    return validated;
  }

  private static void validateAttribute(
      final OntologyAttribute attribute, final AttributeKeys keys) {
    if (attribute == null) {
      throw new BadRequestException("Ontology attributes cannot contain null entries");
    }
    requireUnique(attribute.getId(), keys.ids(), "identifier");
    requireUnique(normalizedName(attribute), keys.names(), "name");
    validateIri(attribute.getIri(), keys.iris());
    validateEnumValues(attribute);
  }

  private static String normalizedName(final OntologyAttribute attribute) {
    final String name = attribute.getName() == null ? null : attribute.getName().toString();
    if (nullOrEmpty(name) || name.isBlank()) {
      throw new BadRequestException("Every ontology attribute requires a non-blank name");
    }
    return name.toLowerCase(Locale.ROOT);
  }

  private static void validateIri(final URI iri, final Set<URI> iris) {
    if (iri != null && !iri.isAbsolute()) {
      throw new BadRequestException("Ontology attribute IRI '" + iri + "' must be absolute");
    }
    if (iri != null) {
      requireUnique(iri, iris, "IRI");
    }
  }

  private static void validateEnumValues(final OntologyAttribute attribute) {
    final boolean hasValues = !nullOrEmpty(attribute.getEnumValues());
    final boolean isEnum = attribute.getDataType() == OntologyAttributeDataType.ENUM;
    if (isEnum && !hasValues) {
      throw new BadRequestException(
          "ENUM ontology attribute '" + attribute.getName() + "' requires enumValues");
    }
    if (!isEnum && hasValues) {
      throw new BadRequestException(
          "Only ENUM ontology attributes can define enumValues: '" + attribute.getName() + "'");
    }
  }

  private static <T> void requireUnique(final T value, final Set<T> values, final String field) {
    if (value == null || !values.add(value)) {
      throw new BadRequestException("Ontology attribute " + field + " must be present and unique");
    }
  }

  private record AttributeKeys(Set<UUID> ids, Set<String> names, Set<URI> iris) {
    private AttributeKeys() {
      this(new HashSet<>(), new HashSet<>(), new HashSet<>());
    }
  }
}
