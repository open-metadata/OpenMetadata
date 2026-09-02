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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.OntologyImportResult;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyAttribute;

/** Cross-cutting integration coverage for database-primary ontology governance APIs. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyGovernanceIT {
  private static final String FORMAT_JSON_LD = "jsonld";
  private static final String FORMAT_TURTLE = "turtle";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void importsSafeInlineJsonLdAndRejectsRemoteContexts(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String inlineJsonLd =
        """
        {
          "@context": {
            "Concept": "http://www.w3.org/2004/02/skos/core#Concept",
            "prefLabel": "http://www.w3.org/2004/02/skos/core#prefLabel"
          },
          "@id": "https://example.org/safe#JsonLdConcept",
          "@type": "Concept",
          "prefLabel": "JSON-LD Concept"
        }
        """;

    OntologyImportResult imported = importJsonLd(glossary, inlineJsonLd, false);

    assertEquals(1, imported.getTermsCreated());
    GlossaryTerm term =
        SdkClients.adminClient()
            .glossaryTerms()
            .getByName(glossary.getFullyQualifiedName() + ".JsonLdConcept");
    assertEquals(URI.create("https://example.org/safe#JsonLdConcept"), term.getIri());

    String remoteContext =
        """
        {"@context":"https://untrusted.invalid/context.jsonld",
         "@id":"https://example.org/unsafe#RemoteContext"}
        """;
    HttpResponse<String> rejected = sendImport(glossary, remoteContext, "jsonld", true);
    assertEquals(400, rejected.statusCode(), rejected.body());
    assertTrue(rejected.body().contains("context"), rejected.body());
  }

  @Test
  void duplicatesMultiDomainDatatypePropertyWithoutLosingItsIri(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String ontology =
        """
        @prefix ex: <https://example.org/multi-domain#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Customer a owl:Class .
        ex:Supplier a owl:Class .
        ex:rating a owl:DatatypeProperty ;
          rdfs:domain ex:Customer, ex:Supplier ;
          rdfs:range xsd:decimal .
        """;

    OntologyImportResult result = importTurtle(glossary, ontology);
    GlossaryTerm customer = term(glossary, "Customer");
    GlossaryTerm supplier = term(glossary, "Supplier");

    assertEquals(2, result.getCustomPropertiesCreated());
    assertTrue(hasAttribute(customer, "rating", "https://example.org/multi-domain#rating"));
    assertTrue(hasAttribute(supplier, "rating", "https://example.org/multi-domain#rating"));
  }

  @Test
  void preservesAnonymousOwlRestrictionThroughDatabaseExport(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String ontology =
        """
        @prefix ex: <https://example.org/restrictions#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Part a owl:Class .
        ex:Product a owl:Class ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:hasPart ;
            owl:minQualifiedCardinality "1"^^xsd:nonNegativeInteger ;
            owl:onClass ex:Part
          ] .
        ex:hasPart a owl:ObjectProperty .
        """;
    importTurtle(glossary, ontology);

    String nTriples = exportOntology(glossary, "ntriples");

    assertTrue(nTriples.contains("http://www.w3.org/2002/07/owl#Restriction"), nTriples);
    assertTrue(
        nTriples.contains("http://www.w3.org/2002/07/owl#minQualifiedCardinality"), nTriples);
    assertTrue(nTriples.contains("https://example.org/restrictions#hasPart"), nTriples);
  }

  @Test
  void scopedSparqlCannotObserveAnotherGlossaryOrSelectExternalGraphs(TestNamespace ns)
      throws Exception {
    Glossary visibleGlossary = GlossaryTestFactory.createWithName(ns, "visibleGlossary");
    Glossary isolatedGlossary = GlossaryTestFactory.createWithName(ns, "isolatedGlossary");
    URI visibleIri = URI.create("https://example.org/scoped#VisibleConcept");
    URI isolatedIri = URI.create("https://example.org/scoped#IsolatedConcept");
    createTerm(visibleGlossary, "VisibleConcept", visibleIri);
    createTerm(isolatedGlossary, "IsolatedConcept", isolatedIri);
    SparqlQuery query =
        new SparqlQuery()
            .withQuery("SELECT ?subject WHERE { ?subject ?predicate ?object }")
            .withFormat(SparqlQuery.Format.JSON);

    HttpResponse<String> response = queryOntology(visibleGlossary, query);

    assertEquals(200, response.statusCode(), response.body());
    assertTrue(response.body().contains(visibleIri.toString()), response.body());
    assertFalse(response.body().contains(isolatedIri.toString()), response.body());

    SparqlQuery external =
        new SparqlQuery()
            .withQuery("SELECT * FROM <https://example.org/external> WHERE { ?s ?p ?o }");
    HttpResponse<String> rejected = queryOntology(visibleGlossary, external);
    assertEquals(400, rejected.statusCode(), rejected.body());
  }

  private static OntologyImportResult importTurtle(Glossary glossary, String body)
      throws Exception {
    HttpResponse<String> response = sendImport(glossary, body, FORMAT_TURTLE, false);
    assertEquals(200, response.statusCode(), response.body());
    return OBJECT_MAPPER.readValue(response.body(), OntologyImportResult.class);
  }

  private static OntologyImportResult importJsonLd(Glossary glossary, String body, boolean dryRun)
      throws Exception {
    HttpResponse<String> response = sendImport(glossary, body, FORMAT_JSON_LD, dryRun);
    assertEquals(200, response.statusCode(), response.body());
    return OBJECT_MAPPER.readValue(response.body(), OntologyImportResult.class);
  }

  private static HttpResponse<String> sendImport(
      Glossary glossary, String body, String format, boolean dryRun) throws Exception {
    String path =
        "/v1/glossaries/name/"
            + glossary.getName()
            + "/importRdf?format="
            + format
            + "&dryRun="
            + dryRun;
    return send("PUT", path, body, contentType(format));
  }

  private static String contentType(String format) {
    return FORMAT_JSON_LD.equals(format) ? "application/ld+json" : "text/turtle";
  }

  private static GlossaryTerm term(Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .getByName(glossary.getFullyQualifiedName() + "." + name, "attributes");
  }

  private static boolean hasAttribute(GlossaryTerm term, String name, String iri) {
    return term.getAttributes().stream().anyMatch(attribute -> matches(attribute, name, iri));
  }

  private static boolean matches(OntologyAttribute attribute, String name, String iri) {
    return name.equals(attribute.getName()) && iri.equals(attribute.getIri().toString());
  }

  private static void createTerm(Glossary glossary, String name, URI iri) {
    SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withIri(iri));
  }

  private static String exportOntology(Glossary glossary, String format) throws Exception {
    String path = "/v1/glossaries/" + glossary.getId() + "/exportOntology?format=" + format;
    HttpResponse<String> response = send("GET", path, "", "application/json");
    assertEquals(200, response.statusCode(), response.body());
    return response.body();
  }

  private static HttpResponse<String> queryOntology(Glossary glossary, SparqlQuery query)
      throws Exception {
    String path = "/v1/glossaries/" + glossary.getId() + "/sparql";
    return send("POST", path, OBJECT_MAPPER.writeValueAsString(query), "application/json");
  }

  private static HttpResponse<String> send(
      String method, String path, String body, String contentType) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType)
            .timeout(Duration.ofSeconds(60))
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
