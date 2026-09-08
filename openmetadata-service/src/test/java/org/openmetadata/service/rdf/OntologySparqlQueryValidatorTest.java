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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard.FederationDisallowedException;

class OntologySparqlQueryValidatorTest {
  private OntologySparqlQueryValidator validator;

  @BeforeEach
  void setUp() {
    validator = new OntologySparqlQueryValidator(new SparqlFederationGuard(null));
  }

  @Test
  void acceptsEveryReadOnlyQueryForm() {
    assertDoesNotThrow(() -> validator.validate("SELECT * WHERE { ?s ?p ?o }"));
    assertDoesNotThrow(() -> validator.validate("ASK WHERE { ?s ?p ?o }"));
    assertDoesNotThrow(() -> validator.validate("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }"));
    assertDoesNotThrow(() -> validator.validate("DESCRIBE <https://example.com/concept>"));
  }

  @Test
  void rejectsMissingMalformedAndUpdateQueries() {
    assertThrows(IllegalArgumentException.class, () -> validator.validate(" "));
    assertThrows(IllegalArgumentException.class, () -> validator.validate("SELECT WHERE {"));
    assertThrows(
        IllegalArgumentException.class, () -> validator.validate("DELETE WHERE { ?s ?p ?o }"));
  }

  @Test
  void rejectsProtocolSelectedDatasets() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            validator.validate("SELECT * FROM <https://outside.example/graph> WHERE { ?s ?p ?o }"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            validator.validate(
                "SELECT * FROM NAMED <https://outside.example/graph> WHERE { GRAPH ?g { ?s ?p ?o } }"));
  }

  @Test
  void rejectsFederatedServiceQueries() {
    assertThrows(
        FederationDisallowedException.class,
        () ->
            validator.validate(
                "SELECT * WHERE { SERVICE <https://outside.example/sparql> { ?s ?p ?o } }"));
  }
}
