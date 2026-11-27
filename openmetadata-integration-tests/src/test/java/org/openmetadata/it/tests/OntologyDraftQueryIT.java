package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ResourceLock("ontology-sparql-worker")
@ExtendWith(TestNamespaceExtension.class)
public class OntologyDraftQueryIT extends BaseOntologyApprovalIT {
  private static final SparqlQuery CLASSES =
      new SparqlQuery()
          .withQuery("SELECT ?class WHERE { ?class a <http://www.w3.org/2002/07/owl#Class> }");
  private static final String EXTERNAL_ENDPOINT = "http://localhost:9999/";

  @Test
  void draftScopeSeesAConceptThatTheReleaseScopeDoesNot(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept published = concept(ontology, "Published");
    activate(ns, ontology);
    final OntologyConcept draftOnly = concept(ontology, "DraftOnly");

    assertEquals(
        List.of(published.getIri().toString()), classes(SdkClients.adminClient(), ontology, null));
    assertEquals(
        Set.of(draftOnly.getIri().toString(), published.getIri().toString()),
        Set.copyOf(classes(SdkClients.adminClient(), ontology, "draft")));
    assertEquals(
        classes(SdkClients.adminClient(), ontology, null),
        classes(SdkClients.adminClient(), ontology, "release"));
  }

  @Test
  void draftScopeAnswersBeforeAnyReleaseIsActive(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept first = concept(ontology, "First");

    assertEquals(
        List.of(first.getIri().toString()), classes(SdkClients.adminClient(), ontology, "draft"));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> classes(SdkClients.adminClient(), ontology, "release"))
            .getStatusCode());
  }

  @Test
  void aUserWithoutEditRightsIsRefusedTheDraftScopeAndStillReadsTheRelease(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept published = concept(ontology, "Published");
    activate(ns, ontology);
    concept(ontology, "DraftOnly");

    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> classes(SdkClients.user2Client(), ontology, "draft"))
            .getStatusCode());
    assertEquals(
        List.of(published.getIri().toString()), classes(SdkClients.user2Client(), ontology, null));
  }

  @Test
  void draftScopeRefusesAnExternalServiceClauseAndAnUnknownScope(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    concept(ontology, "First");
    final SparqlQuery service =
        new SparqlQuery()
            .withQuery("SELECT * WHERE { SERVICE <" + EXTERNAL_ENDPOINT + "> { ?s ?p ?o } }");

    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> run(SdkClients.adminClient(), ontology, "draft", service))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> run(SdkClients.adminClient(), ontology, "working", CLASSES))
            .getStatusCode());
  }

  /**
   * EXISTS evaluates its whole graph pattern, SERVICE included, wherever the expression sits. The
   * viewer is a user the other tests here do not query as, so concurrent tests cannot push it past
   * the server's two concurrent SPARQL queries per user.
   */
  @Test
  void aViewerIsRefusedAServiceClauseHiddenInsideAnExpression(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    concept(ontology, "First");
    // The release scope refuses an ontology with no active release before it reads the query.
    activate(ns, ontology);
    final SparqlQuery hidden =
        new SparqlQuery()
            .withQuery(
                "SELECT (EXISTS { SERVICE <"
                    + EXTERNAL_ENDPOINT
                    + "> { ?s ?p ?o } } AS ?reachable) WHERE { }");

    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> run(SdkClients.user1Client(), ontology, null, hidden))
            .getStatusCode());
  }

  private static OntologyConcept concept(final Ontology ontology, final String name) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName(name)
                .withOntology(ontology.getFullyQualifiedName())
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }

  private static List<String> classes(
      final org.openmetadata.sdk.client.OpenMetadataClient client,
      final Ontology ontology,
      final String scope) {
    final JsonNode result = run(client, ontology, scope, CLASSES);
    final List<String> iris = new ArrayList<>();
    result
        .path("results")
        .path("bindings")
        .forEach(binding -> iris.add(binding.path("class").path("value").asText()));
    return iris;
  }

  private static JsonNode run(
      final org.openmetadata.sdk.client.OpenMetadataClient client,
      final Ontology ontology,
      final String scope,
      final SparqlQuery request) {
    final String path =
        "/v1/ontologies/" + ontology.getId() + "/sparql" + (scope == null ? "" : "?scope=" + scope);
    return client.getHttpClient().execute(HttpMethod.POST, path, request, JsonNode.class);
  }
}
