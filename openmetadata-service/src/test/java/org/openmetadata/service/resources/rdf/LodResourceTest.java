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

package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfSerializationFormat;

class LodResourceTest {

  @Test
  void negotiatesSupportedRdfMediaTypesInClientPreferenceOrder() {
    RdfSerializationFormat format =
        LodResource.negotiate(
            List.of(MediaType.valueOf(RdfResource.RDF_XML), MediaType.WILDCARD_TYPE));

    assertEquals(RdfSerializationFormat.RDF_XML, format);
  }

  @Test
  void defaultsGenericAndUnsupportedAcceptHeadersToJsonLd() {
    assertEquals(
        RdfSerializationFormat.JSON_LD,
        LodResource.negotiate(List.of(MediaType.APPLICATION_JSON_TYPE)));
    assertEquals(
        RdfSerializationFormat.JSON_LD, LodResource.negotiate(List.of(MediaType.WILDCARD_TYPE)));
  }
}
