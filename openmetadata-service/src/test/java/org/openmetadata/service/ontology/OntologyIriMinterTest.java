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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class OntologyIriMinterTest {
  private static final UUID CANDIDATE_ID = UUID.fromString("78ba2f96-3584-4429-850f-cef7d4f5d876");

  @ParameterizedTest
  @CsvSource({
    "https://example.org/sales, https://example.org/sales/",
    "https://example.org/sales/, https://example.org/sales/",
    "https://example.org/sales#, https://example.org/sales#",
    "urn:example:sales:, urn:example:sales:"
  })
  void mintsNativeIdentityFromTheNamespaceAndStableId(String namespace, String prefix) {
    assertEquals(
        prefix + CANDIDATE_ID,
        OntologyIriMinter.mint(URI.create(namespace), CANDIDATE_ID).toString());
  }

  @Test
  void rejectsRelativeBaseIri() {
    assertThrows(
        BadRequestException.class,
        () -> OntologyIriMinter.mint(URI.create("relative"), CANDIDATE_ID));
  }
}
