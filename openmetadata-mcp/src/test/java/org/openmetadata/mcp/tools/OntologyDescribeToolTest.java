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

package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class OntologyDescribeToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SECURITY_CONTEXT = mock(CatalogSecurityContext.class);

  @Test
  void servesFullOntologyWithoutARepository() throws IOException {
    OntologyDescribeTool.Result result =
        new OntologyDescribeTool(() -> null).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of());

    assertEquals("full-ontology", result.scope());
    assertEquals("turtle", result.format());
    assertFalse(result.body().isBlank());
  }

  @Test
  void rejectsInvalidResourceIri() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new OntologyDescribeTool(() -> null)
                    .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("resource", "Column")));

    assertEquals("'resource' must be a valid absolute http(s) IRI", exception.getMessage());
  }

  @Test
  void describeRequiresAnEnabledRepository() {
    assertThrows(
        IllegalStateException.class,
        () ->
            new OntologyDescribeTool(() -> null)
                .execute(
                    AUTHORIZER,
                    SECURITY_CONTEXT,
                    Map.of("resource", "https://open-metadata.org/ontology/Column")));
  }

  @Test
  void returnsTypedDescription() throws IOException {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.executeSparqlQueryDirect(anyString(), eq("text/turtle")))
        .thenReturn("@prefix om: <https://open-metadata.org/ontology/> .");

    OntologyDescribeTool.Result result =
        new OntologyDescribeTool(() -> repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of("resource", "https://open-metadata.org/ontology/Column"));

    assertEquals("describe", result.scope());
    assertEquals("turtle", result.format());
    assertEquals("text/turtle", result.mediaType());
  }

  @Test
  void normalizesJsonLdFormat() throws IOException {
    OntologyDescribeTool.Result result =
        new OntologyDescribeTool(() -> null)
            .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("format", "json-ld"));

    assertEquals("jsonld", result.format());
  }
}
