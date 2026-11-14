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
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.OntologyPrefix;

class OntologyLayerValidatorTest {
  @Test
  void rejectsDuplicateNamespaceAliases() {
    OntologyPrefix first = prefix("ex", "https://example.org/");
    OntologyPrefix duplicate = prefix("ex", "https://other.example.org/");
    assertThrows(
        BadRequestException.class,
        () -> OntologyLayerValidator.validatePrefixes(List.of(first, duplicate)));
  }

  @Test
  void rejectsPrefixNamesThatDifferOnlyByCase() {
    OntologyPrefix first = prefix("ex", "https://example.org/");
    OntologyPrefix duplicate = prefix("EX", "https://other.example.org/");
    assertThrows(
        BadRequestException.class,
        () -> OntologyLayerValidator.validatePrefixes(List.of(first, duplicate)));
  }

  @Test
  void preservesDistinctNamespaceSpellings() {
    List<OntologyPrefix> prefixes =
        List.of(
            prefix("upper", "HTTPS://EXAMPLE.org/"),
            prefix("lower", "https://example.org/"),
            prefix("segments", "https://example.org/part/../"));
    OntologyLayerValidator.validatePrefixes(prefixes);
    assertEquals("HTTPS://EXAMPLE.org/", prefixes.getFirst().getNamespace().toString());
  }

  private static OntologyPrefix prefix(final String name, final String namespace) {
    return new OntologyPrefix().withPrefix(name).withNamespace(URI.create(namespace));
  }
}
