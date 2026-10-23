package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.it.tests.NativeOntologyImportPreviewIT.counts;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSummary;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;

/**
 * The client flow that imports a file into a new ontology: the client counts the file without a
 * target, creates the target with a unique name from the file's label and a {@code
 * urn:openmetadata:ontology:<uuid>} identity, then previews and applies under its lease. No
 * endpoint creates and imports in one call.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyImportIntoNewOntologyIT extends BaseOntologyApprovalIT {
  private static final String IDENTITY_PREFIX = "urn:openmetadata:ontology:";

  @Test
  void createsTheTargetFromTheFileLabelThenPreviewsAndAppliesIntoIt(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final String baseIri = "https://example.org/parties/" + ns.shortPrefix() + "/";
    final PreviewNativeOntologyImport file = partyTurtle(baseIri);
    final User owner = client.users().getByName("admin");

    final NativeOntologyImportSummary summary = client.ontologies().previewImport(file);
    assertEquals("Party model", summary.getOntologyLabel());
    assertEquals(counts(2, 0, 0, 0, 1, 0, 0, 0), summary.getCounts());

    final CreateOntology request = newOntologyRequest(summary.getOntologyLabel(), owner);
    final Ontology ontology = ns.trackRoot("ontology", client.ontologies().create(request));
    assertEquals(request.getName(), ontology.getName());
    assertEquals("Party model", ontology.getDisplayName());
    assertEquals(request.getIri(), ontology.getIri());
    assertEquals(URI.create(request.getIri() + ":"), ontology.getNamespace());
    assertEquals(
        List.of(owner.getId()),
        current(ontology).getOwners().stream().map(reference -> reference.getId()).toList());

    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file);
    assertEquals(summary.getCounts(), preview.getSummary().getCounts());
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("newOntologyImport"))));
    final OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "newOntologyEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(3, applied.getApplicationResult().getOperationsApplied());
    assertEquals(Set.of(baseIri + "Customer", baseIri + "Party"), conceptIris(ontology));
    assertEquals(
        counts(0, 0, 0, 0, 0, 0, 2, 1),
        client.ontologies().previewImport(ontology.getId(), file).getSummary().getCounts());
  }

  @Test
  void retryAfterALostCreateResponseRecoversTheSameOntologyByNameAndIri(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final String baseIri = "https://example.org/parties/" + ns.shortPrefix() + "/";
    final PreviewNativeOntologyImport file = partyTurtle(baseIri);
    final CreateOntology request =
        newOntologyRequest("Party model", client.users().getByName("admin"));
    final Ontology created = ns.trackRoot("ontology", client.ontologies().create(request));

    assertEquals(
        409,
        assertThrows(OpenMetadataException.class, () -> client.ontologies().create(request))
            .getStatusCode());
    final Ontology recovered = client.ontologies().getByName(request.getName());
    assertEquals(created.getId(), recovered.getId());
    assertEquals(request.getIri(), recovered.getIri());
    assertNotEquals(Boolean.TRUE, recovered.getDeleted());

    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(recovered.getId(), file);
    assertEquals(counts(2, 0, 0, 0, 1, 0, 0, 0), preview.getSummary().getCounts());
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("retriedImport"))));
    final OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "retryEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(Set.of(baseIri + "Customer", baseIri + "Party"), conceptIris(recovered));
    assertEquals(created.getId(), client.ontologies().getByName(request.getName()).getId());
  }

  /** Mirrors the UI's request: a unique name from the label and a URN identity owned by the user. */
  private static CreateOntology newOntologyRequest(String label, User owner) {
    final UUID id = UUID.randomUUID();
    final String slug = label.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    return new CreateOntology()
        .withName(slug + "-" + id)
        .withDisplayName(label)
        .withIri(URI.create(IDENTITY_PREFIX + id))
        .withNamespace(URI.create(IDENTITY_PREFIX + id + ":"))
        .withOwners(List.of(owner.getEntityReference()));
  }

  private static Set<String> conceptIris(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData()
        .stream()
        .map(OntologyConcept::getIri)
        .map(URI::toString)
        .collect(Collectors.toSet());
  }

  private static PreviewNativeOntologyImport partyTurtle(String baseIri) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(
            """
            @prefix ex: <%s> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            <https://external.example/parties> a owl:Ontology ; rdfs:label "Party model" .
            ex:Customer a owl:Class ; rdfs:label "Customer" ; rdfs:subClassOf ex:Party .
            ex:Party a owl:Class ; rdfs:label "Party" .
            """
                .formatted(baseIri));
  }
}
