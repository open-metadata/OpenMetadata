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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class RdfValidationServiceTest {
  private static final String TURTLE_FORMAT = "turtle";

  @Test
  void validatesAnEntityUsingDescribe() {
    RdfRepository repository = enabledRepository();
    String entityUri = "https://open-metadata.org/entity/table/example";
    when(repository.executeSparqlQueryDirect("DESCRIBE <" + entityUri + ">", TURTLE_FORMAT))
        .thenReturn("");

    RdfValidationService.ValidationResult result =
        new RdfValidationService(repository).validate(entityUri, "json-ld");

    assertEquals("entity", result.scope());
    assertEquals(entityUri, result.entityUri());
    assertEquals("jsonld", result.format());
    assertEquals("application/ld+json", result.mediaType());
  }

  @Test
  void validatesTheFullGraphUsingConstruct() {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(
            "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", TURTLE_FORMAT))
        .thenReturn("");

    RdfValidationService.ValidationResult result =
        new RdfValidationService(repository).validate(null, "turtle");

    assertEquals("full-graph", result.scope());
    verify(repository)
        .executeSparqlQueryDirect(
            eq("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }"), eq(TURTLE_FORMAT));
  }

  @Test
  void rejectsInvalidEntityIriBeforeQueryingTheRepository() {
    RdfRepository repository = enabledRepository();

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> new RdfValidationService(repository).validate("https:opaque", "turtle"));

    assertTrue(exception.getMessage().contains("absolute http(s) IRI"));
  }

  @Test
  void includesParseContextForMalformedRepositoryData() {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(anyString(), eq(TURTLE_FORMAT)))
        .thenReturn("not turtle }");

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> new RdfValidationService(repository).validate(null, "turtle"));

    assertTrue(exception.getMessage().contains("Unable to load RDF data"));
  }

  private static RdfRepository enabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getBaseUri()).thenReturn("https://open-metadata.org/");
    return repository;
  }
}
