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

import org.junit.jupiter.api.Test;

/**
 * Callers legitimately hold either spelling of a serialization, so both must resolve.
 *
 * <p>The MCP tools pass media types - {@code EntityNeighborhoodTool} asks for {@code text/turtle},
 * {@code OntologyDescribeTool} passes {@code format.mediaType()} - while the REST query string and
 * the tool schemas use the short names. Only short names resolved before, so a media type fell
 * through to the writer's RDF/XML default and callers received XML in a response still labelled
 * {@code "format":"turtle"}.
 */
class RdfSerializationFormatMediaTypeTest {

  @Test
  void mediaTypesResolveToTheSameFormatAsShortNames() {
    assertEquals(RdfSerializationFormat.TURTLE, RdfSerializationFormat.parse("text/turtle"));
    assertEquals(
        RdfSerializationFormat.RDF_XML, RdfSerializationFormat.parse("application/rdf+xml"));
    assertEquals(
        RdfSerializationFormat.N_TRIPLES, RdfSerializationFormat.parse("application/n-triples"));
    assertEquals(
        RdfSerializationFormat.JSON_LD, RdfSerializationFormat.parse("application/ld+json"));
  }

  @Test
  void shortNamesStillResolve() {
    assertEquals(RdfSerializationFormat.TURTLE, RdfSerializationFormat.parse("turtle"));
    assertEquals(RdfSerializationFormat.JSON_LD, RdfSerializationFormat.parse("json-ld"));
  }

  /** A media type must round-trip through the enum it names. */
  @Test
  void everyFormatResolvesFromItsOwnMediaType() {
    for (RdfSerializationFormat format : RdfSerializationFormat.values()) {
      assertEquals(format, RdfSerializationFormat.parse(format.mediaType()));
      assertEquals(format, RdfSerializationFormat.parse(format.externalName()));
    }
  }
}
