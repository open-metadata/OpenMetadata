package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyUrnIriExportIT extends OntologyReleaseExportSupport {
  private static final List<String> FORMATS =
      List.of("turtle", "rdfxml", "ntriples", "jsonld", "skos", "skosxl", "csv");

  @Test
  void anOntologyWhoseIriIsAUrnWithoutANameExportsInEveryFormat(TestNamespace ns) {
    URI iri = URI.create("urn:" + ns.shortPrefix());
    Ontology ontology = createWithIri(ns, "bareUrn", iri);
    declareClass(ontology, "Customer", URI.create("urn:Customer"));

    for (String format : FORMATS) {
      assertEquals(
          200,
          draftExport(ontology.getId(), format).status(),
          format + " export of the draft succeeds");
    }
    Model rdfXml = ModelFactory.createDefaultModel();
    RDFParser.fromString(draftExport(ontology.getId(), "rdfxml").body(), Lang.RDFXML).parse(rdfXml);
    assertTrue(rdfXml.contains(rdfXml.createResource(iri.toString()), RDF.type, OWL2.Ontology));
    assertTrue(rdfXml.contains(rdfXml.createResource("urn:Customer"), RDF.type, OWL2.Class));
  }

  @Test
  void aReleaseOfThatOntologyExportsAsRdfXmlAndPassesTheShaclGate(TestNamespace ns) {
    URI iri = URI.create("urn:" + ns.shortPrefix());
    Ontology ontology = createWithIri(ns, "bareUrnRelease", iri);
    declareClass(ontology, "Customer", URI.create("urn:Customer"));
    OntologyRelease release = capture(ontology);

    for (String format : FORMATS) {
      String content = export(SdkClients.adminClient(), release.getId(), format);
      assertTrue(content.contains(iri.toString()), format + " release export names the IRI");
    }
    assertTrue(
        export(SdkClients.adminClient(), release.getId(), "rdfxml", "&shaclGate=true")
            .contains("rdf:RDF"));
  }

  private static Ontology createWithIri(TestNamespace ns, String name, URI iri) {
    var request = request(ns).withName(ns.prefix(name));
    request.setIri(iri);
    Ontology ontology = SdkClients.adminClient().ontologies().create(request);
    ns.trackRoot("ontology", ontology);
    return ontology;
  }

  private record DraftExport(int status, String body) {}

  private static DraftExport draftExport(UUID id, String format) {
    String path = "/v1/ontologies/" + id + "/export?format=" + format + "&includeInverses=true";
    try {
      String body =
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  path,
                  null,
                  RequestOptions.builder().header("Accept", "*/*").build());
      return new DraftExport(200, body);
    } catch (OpenMetadataException e) {
      return new DraftExport(e.getStatusCode(), String.valueOf(e.getMessage()));
    }
  }
}
