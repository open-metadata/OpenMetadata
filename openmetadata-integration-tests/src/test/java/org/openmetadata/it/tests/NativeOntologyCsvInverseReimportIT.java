package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.models.ListParams;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyCsvInverseReimportIT extends BaseOntologyApprovalIT {
  private static final String HEADER =
      "kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy";

  @Test
  void importingACsvThatNamesAnInverseOnOneSideTwiceKeepsThePair(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final String baseIri = "https://example.org/inverse/" + ns.shortPrefix() + "/";
    final var file = csv(baseIri);

    final var preview = client.ontologies().previewImport(ontology.getId(), file);
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("inverseCsv"))));
    assertEquals(
        OntologyChangeSetState.APPLIED,
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "inverseCsvEditor")
            .getState());
    assertPair(ontology, baseIri);

    assertEquals(
        List.of(),
        client.ontologies().previewImport(ontology.getId(), file).getChangeSet().getOperations());
    assertPair(ontology, baseIri);
  }

  private static void assertPair(Ontology ontology, String baseIri) {
    assertEquals(URI.create(baseIri + "boughtBy"), inverseOf(ontology, baseIri + "buys"));
    assertEquals(URI.create(baseIri + "buys"), inverseOf(ontology, baseIri + "boughtBy"));
  }

  private static URI inverseOf(Ontology ontology, String iri) {
    final var client = SdkClients.adminClient();
    final OntologyProperty listed =
        client
            .ontologyProperties()
            .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
            .getData()
            .stream()
            .filter(item -> URI.create(iri).equals(item.getIri()))
            .findFirst()
            .orElseThrow();
    return client.ontologyProperties().get(listed.getId()).getInverse();
  }

  private static PreviewNativeOntologyImport csv(String baseIri) {
    final var rows = new ArrayList<String>();
    rows.add(HEADER);
    rows.add(objectProperty(baseIri + "buys", baseIri + "boughtBy"));
    rows.add(objectProperty(baseIri + "boughtBy", ""));
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.CSV)
        .withData(String.join("\r\n", rows) + "\r\n");
  }

  private static String objectProperty(String iri, String inverse) {
    final var cells = new ArrayList<>(Collections.nCopies(27, ""));
    cells.set(0, "PROPERTY");
    cells.set(1, iri);
    cells.set(8, "OBJECT");
    cells.set(14, inverse);
    return String.join(",", cells);
  }
}
