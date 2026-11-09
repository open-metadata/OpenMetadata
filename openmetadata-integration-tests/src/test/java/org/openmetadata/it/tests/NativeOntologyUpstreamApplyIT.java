package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;

/**
 * A plan the importer produces from a published ontology must apply: whatever the importer
 * skipped cannot leave a kept definition or axiom pointing at something that is not there. The
 * files are the verbatim upstream fixtures the service unit tests read.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyUpstreamApplyIT extends BaseOntologyApprovalIT {
  private static final Path UPSTREAM =
      Path.of("..", "openmetadata-service", "src", "test", "resources", "ontology", "upstream");

  @ParameterizedTest
  @ValueSource(
      strings = {
        "dcat3.ttl",
        "foaf.rdf",
        "odrl.ttl",
        "org.ttl",
        "prov-o.ttl",
        "skos.rdf",
        "sosa.ttl",
        "ssn.ttl",
        "time.ttl"
      })
  void everyUpstreamOntologyPreviewsAndAppliesIntoAFreshOntology(String file, TestNamespace ns)
      throws IOException {
    final Ontology ontology = createOntology(ns, file.replaceAll("[^A-Za-z0-9]", "_"));

    final OntologyChangeSet applied = previewAndApply(ontology, file, ns);

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertTrue(applied.getApplicationResult().getOperationsApplied() > 0, file);
  }

  @Test
  void ssnAppliesIntoAnOntologyThatAlreadyHoldsSosa(TestNamespace ns) throws IOException {
    final Ontology ontology = createOntology(ns, "sosaThenSsn");

    previewAndApply(ontology, "sosa.ttl", ns);
    final OntologyChangeSet applied = previewAndApply(ontology, "ssn.ttl", ns);

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
  }

  private static OntologyChangeSet previewAndApply(Ontology ontology, String file, TestNamespace ns)
      throws IOException {
    final var client = SdkClients.adminClient();
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), request(file));
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("upstream_" + file))));
    return OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "upstreamEditor");
  }

  private static PreviewNativeOntologyImport request(String file) throws IOException {
    final NativeOntologyImportFormat format =
        file.endsWith(".rdf")
            ? NativeOntologyImportFormat.RDFXML
            : NativeOntologyImportFormat.TURTLE;
    return new PreviewNativeOntologyImport()
        .withFormat(format)
        .withData(Files.readString(UPSTREAM.resolve(file), StandardCharsets.UTF_8));
  }
}
