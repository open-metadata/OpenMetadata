package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportItem;
import org.openmetadata.schema.api.data.NativeOntologyImportItemStatus;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;

/** Import review end to end: item list, selective apply, the second import, and draft export. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyImportReviewIT extends BaseOntologyApprovalIT {
  private static final String PREFIXES =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <https://example.org/review/%s/> .
      """;

  @Test
  void previewListsItemsApplyNamesThemFromTheIriAndASecondImportFindsEveryOne(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewImport");
    final PreviewNativeOntologyImport file = turtle(ns, partyModel());

    final NativeOntologyImportPreview first =
        client.ontologies().previewImport(ontology.getId(), file);

    assertEquals(
        Set.of(NativeOntologyImportItemStatus.NEW),
        first.getSummary().getItems().stream()
            .map(NativeOntologyImportItem::getStatus)
            .collect(Collectors.toSet()));
    assertEquals(5, first.getSummary().getItems().size(), first.getSummary().getItems().toString());
    apply(ns, ontology, first, "firstImport");

    assertEquals(
        Set.of("Customer", "Party", "Supplier"),
        concepts(ontology).stream().map(OntologyConcept::getName).collect(Collectors.toSet()));
    final NativeOntologyImportPreview second =
        client.ontologies().previewImport(ontology.getId(), file);
    assertEquals(5, second.getSummary().getItems().size());
    assertTrue(
        second.getSummary().getItems().stream()
            .allMatch(item -> item.getStatus() == NativeOntologyImportItemStatus.ALREADY_EXISTS),
        second.getSummary().getItems().toString());
    assertEquals(0, second.getChangeSet().getOperations().size());
  }

  @Test
  void applyingOnlyTheChosenItemsCreatesOnlyThose(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewSelect");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), turtle(ns, partyModel()));
    final Set<java.util.UUID> dropped =
        preview.getSummary().getItems().stream()
            .filter(
                item ->
                    item.getLabel().equals("Supplier")
                        || item.getLabel().equals("Supplier is a kind of Party"))
            .map(NativeOntologyImportItem::getOperationId)
            .collect(Collectors.toSet());
    assertEquals(2, dropped.size());

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> !dropped.contains(operation.getId()))
            .toList();
    apply(
        ns,
        ontology,
        preview.withChangeSet(
            preview.getChangeSet().withOperations(chosen).withUndoCursor(chosen.size())),
        "chosenOnly");

    assertEquals(
        Set.of("Customer", "Party"),
        concepts(ontology).stream().map(OntologyConcept::getName).collect(Collectors.toSet()));
  }

  @Test
  void aRangeOutsideTheOwlDatatypeMapIsSkippedAndReported(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewDatatype");
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();

    final NativeOntologyImportPreview preview =
        client
            .ontologies()
            .previewImport(
                ontology.getId(),
                turtle(
                    ns,
                    "ex:when a owl:DatatypeProperty ; rdfs:label \"when\" ; rdfs:range xsd:date ."));

    final var groups = preview.getSummary().getSkippedStatements().getGroups();
    assertEquals(1, groups.size(), groups.toString());
    assertEquals(
        NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, groups.getFirst().getReason());
    assertEquals(RDFS.range.getURI(), groups.getFirst().getPredicate());
    assertEquals(1, groups.getFirst().getCount());
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
  }

  @Test
  void aFileThatCreatesADisjointnessClashWarnsOnItsItemsAndNamesTheConcepts(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewClash");

    final NativeOntologyImportPreview preview =
        client
            .ontologies()
            .previewImport(
                ontology.getId(),
                turtle(
                    ns,
                    """
                    ex:Animal a owl:Class ; rdfs:label "Animal" .
                    ex:Plant a owl:Class ; rdfs:label "Plant" .
                    ex:Both a owl:Class ; rdfs:label "Both" .
                    ex:Animal owl:disjointWith ex:Plant .
                    ex:Both rdfs:subClassOf ex:Animal .
                    ex:Both rdfs:subClassOf ex:Plant .
                    """));

    final var warned =
        preview.getSummary().getItems().stream().filter(item -> item.getWarning() != null).toList();
    assertFalse(warned.isEmpty());
    assertTrue(
        warned.stream()
            .allMatch(
                item -> item.getWarning().equals("Both has disjoint ancestors Animal and Plant")),
        warned.toString());
    assertEquals(3, warned.getFirst().getConceptIds().size());
  }

  @Test
  void aLibraryPackReviewListsItsItemsAndAddsNoWarningToAnOntologyThatAlreadyClashes(
      TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewPack");
    apply(
        ns,
        ontology,
        client
            .ontologies()
            .previewImport(
                ontology.getId(),
                turtle(
                    ns,
                    """
                    ex:Animal a owl:Class . ex:Plant a owl:Class . ex:Both a owl:Class .
                    ex:Animal owl:disjointWith ex:Plant .
                    ex:Both rdfs:subClassOf ex:Animal .
                    ex:Both rdfs:subClassOf ex:Plant .
                    """)),
        "alreadyClashing");

    final NativeOntologyImportPreview review =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/library/dcat/review",
                new PreviewNativeOntologyPack().withModuleIds(Set.of("dcat")),
                NativeOntologyImportPreview.class);

    assertFalse(review.getSummary().getItems().isEmpty());
    assertTrue(
        review.getSummary().getItems().stream()
            .allMatch(
                item ->
                    item.getStatus() == NativeOntologyImportItemStatus.NEW
                        || item.getStatus() == NativeOntologyImportItemStatus.SKIPPED),
        "a first import of a library pack creates or skips, never updates");
    assertTrue(
        review.getSummary().getItems().stream()
            .anyMatch(item -> item.getStatus() == NativeOntologyImportItemStatus.NEW));
    assertTrue(review.getSummary().getItems().stream().allMatch(item -> item.getWarning() == null));
    assertEquals("dcat", review.getChangeSet().getSourcePack().getPackId());
  }

  @Test
  void draftExportHoldsUnpublishedConceptsAndLeavesTheReleaseHistoryAlone(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "reviewDraft");
    declareClass(ontology, "Published", java.net.URI.create("https://example.org/draft/Published"));
    final var release = capture(ontology);
    declareClass(
        ontology, "Unpublished", java.net.URI.create("https://example.org/draft/Unpublished"));

    final String draft = exportDraft(ontology, "turtle");
    final String sealed =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/export?format=turtle",
                null,
                org.openmetadata.sdk.network.RequestOptions.builder()
                    .header("Accept", "*/*")
                    .build());

    assertTrue(draft.contains("https://example.org/draft/Unpublished"));
    assertTrue(draft.contains("https://example.org/draft/Published"));
    assertFalse(sealed.contains("https://example.org/draft/Unpublished"));
    final String history =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/ontologies/" + ontology.getId() + "/releases",
                null,
                org.openmetadata.sdk.network.RequestOptions.builder()
                    .header("Accept", "application/json")
                    .build());
    final var releases = org.openmetadata.schema.utils.JsonUtils.readTree(history).get("data");
    assertEquals(1, releases.size(), history);
    assertEquals(release.getId().toString(), releases.get(0).get("id").asText());
  }

  @Test
  void anOntologyWithNoReleaseStillExportsItsDraftInEveryFormat(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "reviewDraftOnly");
    declareClass(ontology, "Solo", java.net.URI.create("https://example.org/draft/Solo"));

    for (final String format : List.of("turtle", "rdfxml", "jsonld", "csv", "skos")) {
      assertTrue(exportDraft(ontology, format).contains("https://example.org/draft/Solo"), format);
    }
  }

  @Test
  void aConceptWithoutADisplayNameExportsItsNameAsTheLabelInEveryFormat(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "reviewLabel");
    final String name = "Settlement" + ns.shortPrefix();
    declareClass(ontology, name, java.net.URI.create("https://example.org/label/" + name));

    final java.util.Map<String, String> label =
        java.util.Map.of(
            "turtle", "\"" + name + "\"",
            "rdfxml", ">" + name + "<",
            "jsonld", "\"" + name + "\"",
            "csv", "/" + name + "," + name + ",",
            "skos", "\"" + name + "\"");
    label.forEach(
        (format, needle) ->
            assertTrue(
                exportDraft(ontology, format).contains(needle), format + " lacks " + needle));
  }

  private static String exportDraft(Ontology ontology, String format) {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/export?format=" + format,
            null,
            org.openmetadata.sdk.network.RequestOptions.builder().header("Accept", "*/*").build());
  }

  private static List<OntologyConcept> concepts(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData();
  }

  private static void apply(
      TestNamespace ns, Ontology ontology, NativeOntologyImportPreview preview, String name) {
    final var client = SdkClients.adminClient();
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(preview.getChangeSet().withName(ns.prefix(name))));
    assertEquals(
        OntologyChangeSetState.APPLIED,
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, name + "Editor")
            .getState());
  }

  private static String partyModel() {
    return """
        ex:Party a owl:Class ; rdfs:label "Party" .
        ex:Customer a owl:Class ; rdfs:label "Customer" .
        ex:Supplier a owl:Class ; rdfs:label "Supplier" .
        ex:Customer rdfs:subClassOf ex:Party .
        ex:Supplier rdfs:subClassOf ex:Party .
        """;
  }

  private static PreviewNativeOntologyImport turtle(TestNamespace ns, String body) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(PREFIXES.formatted(ns.shortPrefix()) + body);
  }
}
