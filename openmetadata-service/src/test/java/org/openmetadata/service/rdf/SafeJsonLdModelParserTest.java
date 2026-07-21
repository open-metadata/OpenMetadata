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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.rdf.model.Model;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.BadRequestException;

class SafeJsonLdModelParserTest {
  private final SafeJsonLdModelParser parser = new SafeJsonLdModelParser();

  @Test
  void parsesInlineContextWithoutNetworkAccess() {
    final String document =
        """
        {
          "@context": {"label": "http://www.w3.org/2000/01/rdf-schema#label"},
          "@id": "https://example.org/concept/Customer",
          "label": "Customer"
        }
        """;

    final Model model = parser.parse(document);
    try {
      assertEquals(1, model.size());
      assertTrue(model.containsResource(model.getResource("https://example.org/concept/Customer")));
    } finally {
      model.close();
    }
  }

  @Test
  void resolvesOnlyBundledOpenMetadataContexts() {
    final String document =
        """
        {
          "@context": "https://open-metadata.org/rdf/contexts/base.jsonld",
          "@id": "https://example.org/concept/Customer",
          "name": "Customer"
        }
        """;

    final Model model = parser.parse(document);
    try {
      assertTrue(model.size() > 0);
    } finally {
      model.close();
    }
  }

  @Test
  void rejectsUnapprovedRemoteContext() {
    final String document =
        """
        {
          "@context": "https://example.org/context.jsonld",
          "@id": "https://example.org/concept/Customer"
        }
        """;

    final BadRequestException exception =
        assertThrows(BadRequestException.class, () -> parser.parse(document));

    assertTrue(exception.getMessage().contains("remote context"));
  }
}
