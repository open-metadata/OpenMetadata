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

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class RdfClasspathResourceTest {

  @Test
  void ontologyLoadingFailsFastWhenARequiredResourceIsMissing() {
    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> OntologyDocument.loadModel(List.of("/rdf/ontology/missing.ttl")));

    assertTrue(exception.getMessage().contains("missing.ttl"));
  }

  @Test
  void shaclLoadingFailsFastWhenTheShapesResourceIsMissing() {
    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> RdfShaclValidator.loadShapes("/rdf/shapes/missing.ttl"));

    assertTrue(exception.getMessage().contains("missing.ttl"));
  }
}
