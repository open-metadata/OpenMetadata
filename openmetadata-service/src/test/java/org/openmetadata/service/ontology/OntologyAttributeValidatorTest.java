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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;

class OntologyAttributeValidatorTest {
  @Test
  void acceptsTypedUniqueAttributesAndReturnsImmutableCopy() {
    final OntologyAttribute identifier = attribute("customerId", OntologyAttributeDataType.STRING);
    final OntologyAttribute tier =
        attribute("tier", OntologyAttributeDataType.ENUM).withEnumValues(Set.of("Gold", "Silver"));

    final List<OntologyAttribute> validated =
        OntologyAttributeValidator.validate(List.of(identifier, tier));

    assertEquals(List.of(identifier, tier), validated);
    assertThrows(UnsupportedOperationException.class, () -> validated.add(identifier));
  }

  @Test
  void rejectsDuplicateNamesCaseInsensitively() {
    final OntologyAttribute first = attribute("rating", OntologyAttributeDataType.DECIMAL);
    final OntologyAttribute second = attribute("RATING", OntologyAttributeDataType.DECIMAL);

    assertThrows(
        BadRequestException.class,
        () -> OntologyAttributeValidator.validate(List.of(first, second)));
  }

  @Test
  void enforcesEnumValueContract() {
    final OntologyAttribute emptyEnum = attribute("tier", OntologyAttributeDataType.ENUM);
    final OntologyAttribute valuesOnString =
        attribute("region", OntologyAttributeDataType.STRING).withEnumValues(Set.of("US"));

    assertThrows(
        BadRequestException.class, () -> OntologyAttributeValidator.validate(List.of(emptyEnum)));
    assertThrows(
        BadRequestException.class,
        () -> OntologyAttributeValidator.validate(List.of(valuesOnString)));
  }

  @Test
  void rejectsRelativeAndDuplicateIris() {
    final OntologyAttribute relative =
        attribute("relative", OntologyAttributeDataType.STRING).withIri(URI.create("relative"));
    final URI sharedIri = URI.create("https://example.org/property/shared");
    final OntologyAttribute first =
        attribute("first", OntologyAttributeDataType.STRING).withIri(sharedIri);
    final OntologyAttribute second =
        attribute("second", OntologyAttributeDataType.STRING).withIri(sharedIri);

    assertThrows(
        BadRequestException.class, () -> OntologyAttributeValidator.validate(List.of(relative)));
    assertThrows(
        BadRequestException.class,
        () -> OntologyAttributeValidator.validate(List.of(first, second)));
  }

  private static OntologyAttribute attribute(
      final String name, final OntologyAttributeDataType dataType) {
    return new OntologyAttribute()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDataType(dataType)
        .withEnumValues(Set.of())
        .withIsIdentifier(false);
  }
}
