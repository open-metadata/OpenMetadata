package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseKindCounts;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseKindCountsIT extends BaseOntologyApprovalIT {
  @Test
  void aFirstReleaseCountsItsOntologyRowApartFromItsConcepts(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    declareClass(ontology, "Customer", iri(ontology, "Customer"));
    declareClass(ontology, "Account", iri(ontology, "Account"));

    final OntologyRelease stored = current(capture(ontology));

    final OntologyReleaseKindCounts kinds = stored.getChangeSummary().getKindCounts();
    assertEquals(1, kinds.getOntology());
    assertEquals(2, kinds.getConcept());
    assertEquals(0, kinds.getProperty());
    assertEquals(0, kinds.getAssociation());
    assertEquals(0, kinds.getAxiom());
    assertEquals(0, kinds.getShape());
  }

  @Test
  void aLaterReleaseCountsEditsAdditionsAndRemovalsAgainstTheActiveRelease(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept edited = declareClass(ontology, "Edited", iri(ontology, "Edited"));
    final OntologyConcept removed = declareClass(ontology, "Removed", iri(ontology, "Removed"));
    declareClass(ontology, "Kept", iri(ontology, "Kept"));
    activate(ns, ontology);

    final var concepts = SdkClients.adminClient().ontologyConcepts();
    concepts.update(edited.getId().toString(), edited.withDescription("Reworded"));
    concepts.delete(removed.getId().toString(), Map.of("hardDelete", "true"));
    declareClass(ontology, "Added", iri(ontology, "Added"));
    final OntologyRelease release = capture(ontology);

    final var summary = current(release).getChangeSummary();
    assertEquals(1, summary.getAdded());
    assertEquals(1, summary.getChanged());
    assertEquals(1, summary.getRemoved());
    assertEquals(3, summary.getKindCounts().getConcept());
    assertEquals(0, summary.getKindCounts().getOntology());
    assertEquals(
        summary.getAdded() + summary.getChanged() + summary.getRemoved() + summary.getDeprecated(),
        SdkClients.adminClient()
            .ontologyReleases()
            .diff(release.getId(), null, 100, null)
            .getPaging()
            .getTotal());
  }

  private static URI iri(Ontology ontology, String name) {
    return URI.create(ontology.getNamespace() + name);
  }
}
