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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.Test;

class RdfBlankNodeCanonicalizerTest {
  private final RdfBlankNodeCanonicalizer canonicalizer = new RdfBlankNodeCanonicalizer();

  @Test
  void canonicalizesIsomorphicBlankNodeGraphsIdentically() {
    String first =
        """
        @prefix ex: <https://example.org/> .
        ex:Product ex:restriction [ ex:on ex:category ; ex:min 1 ] .
        """;
    String reordered =
        """
        @prefix ex: <https://example.org/> .
        _:different ex:min 1 ; ex:on ex:category .
        ex:Product ex:restriction _:different .
        """;

    String firstCanonical = canonicalize(first);
    String secondCanonical = canonicalize(reordered);

    assertEquals(firstCanonical, secondCanonical);
    assertTrue(firstCanonical.contains("urn:openmetadata:annex:"));
  }

  @Test
  void producesStableSha256Checksum() {
    String canonical = canonicalize("<urn:s> <urn:p> <urn:o> .");

    assertEquals(64, canonicalizer.checksum(canonical).length());
  }

  private String canonicalize(final String turtle) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      model.read(new StringReader(turtle), null, "TURTLE");
      return canonicalizer.canonicalize(model);
    } finally {
      model.close();
    }
  }
}
