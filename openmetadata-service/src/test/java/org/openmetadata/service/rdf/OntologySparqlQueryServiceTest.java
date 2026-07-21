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

import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologySparqlQueryServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void executesTupleQueriesAndClosesTheMaterializedModel() {
    final Model model = modelWithStatement();
    final SparqlQuery request =
        request("SELECT ?subject WHERE { ?subject <urn:predicate> <urn:object> }")
            .withFormat(SparqlQuery.Format.JSON);

    final OntologySparqlQueryService.QueryResult result =
        service(model).query(GLOSSARY_ID, request);

    assertEquals("application/sparql-results+json", result.mediaType());
    assertTrue(result.body().contains("urn:subject"));
    assertTrue(model.isClosed());
  }

  @Test
  void serializesAskAndGraphQueriesInTheirRequestedFormats() {
    final OntologySparqlQueryService.QueryResult ask =
        service(modelWithStatement())
            .query(
                GLOSSARY_ID,
                request("ASK { <urn:subject> <urn:predicate> <urn:object> }")
                    .withFormat(SparqlQuery.Format.XML));
    final OntologySparqlQueryService.QueryResult graph =
        service(modelWithStatement())
            .query(
                GLOSSARY_ID,
                request(
                        "CONSTRUCT { ?subject ?predicate ?object } "
                            + "WHERE { ?subject ?predicate ?object }")
                    .withFormat(SparqlQuery.Format.TURTLE));

    assertTrue(ask.body().contains("<boolean>true</boolean>"));
    assertTrue(graph.body().contains("<urn:subject>"));
  }

  @Test
  void appliesRdfsInferenceInsideTheOntologyScope() {
    final Model model = ModelFactory.createDefaultModel();
    final Resource child = model.createResource("urn:Child");
    final Resource parent = model.createResource("urn:Parent");
    child.addProperty(RDFS.subClassOf, parent);
    model.createResource("urn:instance").addProperty(RDF.type, child);
    final SparqlQuery request =
        request("ASK { <urn:instance> a <urn:Parent> }").withInference(SparqlQuery.Inference.RDFS);

    final OntologySparqlQueryService.QueryResult result =
        service(model).query(GLOSSARY_ID, request);

    assertTrue(result.body().contains("true"));
  }

  @Test
  void rejectsMutationAndMalformedQueries() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("INSERT DATA { <urn:s> <urn:p> <urn:o> }")));
    assertThrows(
        IllegalArgumentException.class, () -> service.query(GLOSSARY_ID, request("not sparql")));
  }

  @Test
  void rejectsRemoteDatasetAndServiceAccess() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * FROM <https://example.com/data> WHERE { ?s ?p ?o }")));
    assertThrows(
        SparqlFederationGuard.FederationDisallowedException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * WHERE { SERVICE <https://example.com/sparql> { ?s ?p ?o } }")));
  }

  @Test
  void rejectsFormatsThatDoNotMatchTheQueryShape() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("SELECT * WHERE { ?s ?p ?o }").withFormat(SparqlQuery.Format.TURTLE)));
  }

  @Test
  void rejectsUnboundedTimeoutsAndGlobalCustomInference() {
    final OntologySparqlQueryService service = service(modelWithStatement());

    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("ASK { ?s ?p ?o }").withTimeout(300_001)));
    assertThrows(
        IllegalArgumentException.class,
        () -> service.query(GLOSSARY_ID, request("ASK { ?s ?p ?o }").withTimeout(0)));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.query(
                GLOSSARY_ID,
                request("ASK { ?s ?p ?o }").withInference(SparqlQuery.Inference.CUSTOM)));
  }

  @Test
  void appliesDefaultLimitsAndRejectsLimitsAboveTheMaximum() {
    final Model model = ModelFactory.createDefaultModel();
    for (int index = 0; index < SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1; index++) {
      model.add(
          model.createResource("urn:subject:" + index),
          model.createProperty("urn:predicate"),
          model.createResource("urn:object"));
    }

    final OntologySparqlQueryService.QueryResult result =
        service(model)
            .query(
                GLOSSARY_ID,
                request("SELECT ?subject WHERE { ?subject <urn:predicate> <urn:object> }")
                    .withFormat(SparqlQuery.Format.CSV));

    assertEquals(SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1, result.body().lines().count());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service(modelWithStatement())
                .query(GLOSSARY_ID, request("SELECT * WHERE { ?s ?p ?o } LIMIT 10001")));
  }

  private static OntologySparqlQueryService service(final Model model) {
    return new OntologySparqlQueryService(
        (glossaryId, includeRelations) -> model, new SparqlFederationGuard(null));
  }

  private static Model modelWithStatement() {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource("urn:subject"),
        model.createProperty("urn:predicate"),
        model.createResource("urn:object"));
    return model;
  }

  private static SparqlQuery request(final String query) {
    return new SparqlQuery().withQuery(query);
  }
}
