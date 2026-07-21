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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.OntologyImportResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyAnnexRevision;
import org.openmetadata.service.ontology.RdfBlankNodeCanonicalizer;
import org.openmetadata.service.ontology.RdfRoundTripScorecard;
import org.openmetadata.service.ontology.RdfRoundTripScorecard.Construct;
import org.openmetadata.service.ontology.RdfRoundTripScorecard.Scorecard;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RdfRoundTripFidelityIT {
  private static final String CORPUS_ROOT = "ontology/fidelity/";
  private static final String OM_NAMESPACE = "https://open-metadata.org/ontology/";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final RdfRoundTripScorecard SCORER = new RdfRoundTripScorecard();

  @BeforeAll
  static void initializeClient() {
    final String adminToken = System.getenv("OM_ADMIN_TOKEN");
    if (nullOrEmpty(adminToken)) {
      SdkClients.adminClient();
    } else {
      SdkClients.overrideAdminToken(adminToken);
    }
  }

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("fixtures")
  void preservesCorpusAcrossIdempotentImport(final Fixture fixture, final TestNamespace namespace)
      throws Exception {
    final Glossary glossary = GlossaryTestFactory.createWithName(namespace, fixture.id());
    final String rdfXml = readFixture(fixture);
    final OntologyImportResult firstImport = importOntology(glossary, rdfXml);
    final String firstExport = exportOntology(glossary);
    final Scorecard scorecard = score(fixture, rdfXml, firstExport, firstImport);

    assertScorecard(fixture, scorecard);
    SCORER.writeMarkdown(scorecard, scorecardPath(fixture));

    final OntologyImportResult secondImport = importOntology(glossary, rdfXml);
    final String secondExport = exportOntology(glossary);
    assertEquals(0, secondImport.getTermsCreated(), secondImport.getMessages().toString());
    assertEquals(canonical(firstExport), canonical(secondExport), fixture.id());
  }

  @Test
  void scopesExportToRequestedGlossary(final TestNamespace namespace) throws Exception {
    final Glossary source = GlossaryTestFactory.createWithName(namespace, "source");
    final Glossary target = GlossaryTestFactory.createWithName(namespace, "target");
    final GlossaryTerm sourceTerm =
        GlossaryTermTestFactory.createWithName(namespace, source, "sourceTerm");

    final String sourceExport = exportOntology(source);
    final String targetExport = exportOntology(target);

    assertQueryMetadata(sourceExport, sourceTerm);
    assertFalse(targetExport.contains(sourceTerm.getId().toString()), targetExport);
  }

  private static void assertQueryMetadata(final String exported, final GlossaryTerm term) {
    final Model model = parse(exported, Lang.NTRIPLES);
    try {
      final Property fqn = model.createProperty(OM_NAMESPACE, "fullyQualifiedName");
      final Resource resource =
          model.listSubjectsWithProperty(fqn, term.getFullyQualifiedName()).next();
      assertTrue(resource.getURI().endsWith("/entity/glossaryTerm/" + term.getId()));
      assertTrue(
          model.contains(resource, RDF.type, model.createResource(OM_NAMESPACE + "GlossaryTerm")));
    } finally {
      model.close();
    }
  }

  private static Scorecard score(
      final Fixture fixture,
      final String sourceRdfXml,
      final String exportedNTriples,
      final OntologyImportResult importResult) {
    final Model source = parse(sourceRdfXml, Lang.RDFXML);
    final Model exported = parse(exportedNTriples, Lang.NTRIPLES);
    final Scorecard scorecard;
    try {
      scorecard = SCORER.analyze(fixture.id(), source, exported, latestAnnex(importResult));
    } finally {
      exported.close();
      source.close();
    }
    return scorecard;
  }

  private static void assertScorecard(final Fixture fixture, final Scorecard scorecard) {
    assertTrue(scorecard.sourceTriples() > 0, fixture.id());
    assertEquals(0, scorecard.preservation().lost(), scorecard.toMarkdown());
    fixture.requiredConstructs().forEach(construct -> assertConstruct(scorecard, construct));
  }

  private static void assertConstruct(final Scorecard scorecard, final Construct construct) {
    final long count =
        scorecard.constructs().stream()
            .filter(score -> score.construct() == construct)
            .findFirst()
            .orElseThrow()
            .sourceTriples();
    assertTrue(count > 0, construct.label() + " missing from " + scorecard.fixture());
  }

  private static OntologyImportResult importOntology(final Glossary glossary, final String rdfXml)
      throws Exception {
    final String path =
        "/v1/glossaries/name/" + glossary.getName() + "/importRdf?format=rdfxml&dryRun=false";
    final HttpResponse<String> response = send("PUT", path, rdfXml, "application/rdf+xml");
    assertEquals(200, response.statusCode(), response.body());
    return OBJECT_MAPPER.readValue(response.body(), OntologyImportResult.class);
  }

  private static String exportOntology(final Glossary glossary) throws Exception {
    final String path = "/v1/glossaries/" + glossary.getId() + "/exportOntology?format=ntriples";
    final HttpResponse<String> response = send("GET", path, "", "application/json");
    assertEquals(200, response.statusCode(), response.body());
    return response.body();
  }

  private static HttpResponse<String> send(
      final String method, final String path, final String body, final String contentType)
      throws Exception {
    final HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType)
            .timeout(Duration.ofSeconds(90))
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String latestAnnex(final OntologyImportResult result) {
    final List<OntologyAnnexRevision> revisions = result.getAnnexRevisions();
    final String annex = nullOrEmpty(revisions) ? "" : revisions.getLast().getCanonicalNQuads();
    return annex;
  }

  private static String canonical(final String nTriples) {
    final Model model = parse(nTriples, Lang.NTRIPLES);
    final String canonical;
    try {
      canonical = new RdfBlankNodeCanonicalizer().canonicalize(model);
    } finally {
      model.close();
    }
    return canonical;
  }

  private static Model parse(final String rdf, final Lang language) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(rdf).lang(language).parse(model);
    return model;
  }

  private static String readFixture(final Fixture fixture) throws IOException {
    final String resourcePath = CORPUS_ROOT + fixture.fileName();
    final InputStream resourceStream =
        RdfRoundTripFidelityIT.class.getClassLoader().getResourceAsStream(resourcePath);
    if (resourceStream == null) {
      throw new IOException("Required ontology fixture not found: " + resourcePath);
    }
    try (InputStream stream = resourceStream) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private static Path scorecardPath(final Fixture fixture) {
    return Path.of("target", "ontology-fidelity", fixture.id() + ".md");
  }

  private static Stream<Fixture> fixtures() {
    final List<Construct> enterprise =
        List.of(Construct.CLASSES, Construct.OBJECT_PROPERTIES, Construct.DATATYPE_PROPERTIES);
    return Stream.of(
        new Fixture("fibo-loans-general", "fibo-loans-general.rdf", enterprise),
        new Fixture("fibo-geographic-hierarchy", "fibo-geographic-hierarchy.rdf", enterprise),
        new Fixture("fibo-industry-classification", "fibo-industry-classification.rdf", enterprise),
        new Fixture("schema-local-business", "schema-local-business.rdf", enterprise),
        new Fixture("schema-creative-work", "schema-creative-work.rdf", enterprise),
        new Fixture(
            "pizza",
            "pizza.rdf",
            List.of(
                Construct.CLASSES, Construct.OBJECT_PROPERTIES, Construct.DATATYPE_PROPERTIES)));
  }

  private record Fixture(String id, String fileName, List<Construct> requiredConstructs) {
    private Fixture {
      requiredConstructs = List.copyOf(requiredConstructs);
    }

    @Override
    public String toString() {
      return id;
    }
  }
}
