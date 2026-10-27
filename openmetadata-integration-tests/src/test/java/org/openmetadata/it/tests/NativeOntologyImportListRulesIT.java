package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/** The preview refuses exactly the property lists that applying a draft refuses. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyImportListRulesIT extends BaseOntologyApprovalIT {
  private static final String HEADER =
      "kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy";
  private static final int PROPERTY_KIND = 8;
  private static final int ENUM_VALUES = 11;
  private static final int PROPERTY_CHAIN = 16;

  @Test
  void previewAndApplyRefuseAOneValueEnumeration(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final String iri = iri(ns, "tier");

    assertPreviewRefused(
        ontology, property(iri, "DATA", ENUM_VALUES, "\"\"\"Gold\"\"\""), "enumValues");
    assertApplyRefused(
        ontology,
        "tier",
        OntologyPropertyKind.DATA,
        List.of(new OntologyLiteral().withValue("Gold")),
        null);
  }

  @Test
  void previewAndApplyRefuseDuplicateEnumerationValues(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyLiteral gold = new OntologyLiteral().withValue("Gold");

    assertPreviewRefused(
        ontology,
        property(iri(ns, "tier"), "DATA", ENUM_VALUES, "\"\"\"Gold\"\"\";\"\"\"Gold\"\"\""),
        "enumValues");
    assertApplyRefused(ontology, "tier", OntologyPropertyKind.DATA, List.of(gold, gold), null);
  }

  @Test
  void previewAndApplyRefuseAOneItemPropertyChain(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final String only = iri(ns, "only");

    assertPreviewRefused(
        ontology, property(iri(ns, "path"), "OBJECT", PROPERTY_CHAIN, only), "propertyChain");
    assertApplyRefused(
        ontology, "path", OntologyPropertyKind.OBJECT, null, List.of(URI.create(only)));
  }

  @Test
  void aFilePreviewAcceptsAlsoAppliesWhenItsListsAreUsable(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final var request =
        csv(
            property(iri(ns, "tier"), "DATA", ENUM_VALUES, "\"\"\"Gold\"\"\";\"\"\"Silver\"\"\""),
            property(iri(ns, "path"), "OBJECT", PROPERTY_CHAIN, iri(ns, "a") + ";" + iri(ns, "b")));

    final var preview = client.ontologies().previewImport(ontology.getId(), request);

    assertEquals(2, preview.getSummary().getCounts().getNewProperties());
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("lists"))));
    assertEquals(
        OntologyChangeSetState.APPLIED,
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "listsEditor")
            .getState());
  }

  private void assertPreviewRefused(Ontology ontology, String row, String column) {
    final var thrown =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().ontologies().previewImport(ontology.getId(), csv(row)));
    assertEquals(400, thrown.getStatusCode());
    assertTrue(
        thrown.getMessage().contains("CSV row 2, column " + column + ":"), thrown.getMessage());
  }

  private void assertApplyRefused(
      Ontology ontology,
      String name,
      OntologyPropertyKind kind,
      List<OntologyLiteral> enumValues,
      List<URI> chain) {
    final var request =
        new CreateOntologyProperty()
            .withOntology(ontology.getFullyQualifiedName())
            .withName(name)
            .withKind(kind)
            .withEnumValues(enumValues)
            .withPropertyChain(chain);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.adminClient().ontologyProperties().create(request))
            .getStatusCode());
  }

  private static String iri(TestNamespace ns, String name) {
    return "https://example.org/lists/" + ns.shortPrefix() + "/" + name;
  }

  private static PreviewNativeOntologyImport csv(String... rows) {
    final var lines = new ArrayList<String>();
    lines.add(HEADER);
    lines.addAll(List.of(rows));
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.CSV)
        .withData(String.join("\r\n", lines) + "\r\n");
  }

  private static String property(String iri, String kind, int column, String cell) {
    final var cells = new ArrayList<>(Collections.nCopies(27, ""));
    cells.set(0, "PROPERTY");
    cells.set(1, iri);
    cells.set(PROPERTY_KIND, kind);
    cells.set(
        column,
        cell.contains(",") || cell.contains("\"")
            ? "\"" + cell.replace("\"", "\"\"") + "\""
            : cell);
    return String.join(",", cells);
  }
}
