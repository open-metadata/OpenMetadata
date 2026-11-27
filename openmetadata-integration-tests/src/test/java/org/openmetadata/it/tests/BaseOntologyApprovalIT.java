package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;

abstract class BaseOntologyApprovalIT {
  @AfterEach
  void cleanup(TestNamespace ns) {
    BaseOntologyIT.deleteRoots(ns);
  }

  protected static Ontology createOntology(TestNamespace ns) {
    return createOntology(ns, "reviewedOntology");
  }

  protected static OntologyConcept declareClass(Ontology ontology, String name, URI iri) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withOntology(ontology.getFullyQualifiedName())
                .withName(name)
                .withIri(iri)
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }

  protected static OntologyRelease capture(Ontology ontology) {
    final var service = SdkClients.adminClient().ontologies();
    return service.capture(
        ontology.getId(),
        new CaptureOntologyRelease()
            .withExpectedWorkingRevision(service.state(ontology.getId()).getWorkingRevision()));
  }

  protected static OntologyRelease activate(TestNamespace ns, Ontology ontology) {
    final OntologyRelease release = capture(ontology);
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    SdkClients.adminClient()
        .ontologies()
        .activate(
            ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(0L));
    return release;
  }

  protected static Ontology createOntology(TestNamespace ns, String name) {
    Ontology ontology =
        SdkClients.adminClient().ontologies().create(request(ns).withName(ns.prefix(name)));
    ns.trackRoot("ontology", ontology);
    return ontology;
  }

  protected static CreateOntology request(TestNamespace ns) {
    return new CreateOntology()
        .withName(ns.prefix("reviewedOntology"))
        .withIri(URI.create("https://example.org/model/" + ns.shortPrefix()))
        .withNamespace(URI.create("https://example.org/model/"))
        .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
  }

  protected static Task submit(TestNamespace ns, String type, String fqn) {
    Task task = SdkClients.adminClient().tasks().create(reviewRequest(ns, type, fqn));
    ns.trackRoot("task", task);
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              Task ready = SdkClients.adminClient().tasks().get(task.getId().toString());
              assertNotNull(ready.getWorkflowInstanceId());
              assertEquals(2, ready.getAvailableTransitions().size());
            });
    return SdkClients.adminClient().tasks().get(task.getId().toString());
  }

  protected static CreateTask reviewRequest(TestNamespace ns, String type, String fqn) {
    return new CreateTask()
        .withName(ns.prefix("review"))
        .withCategory(TaskCategory.Approval)
        .withType(TaskEntityType.RequestApproval)
        .withAbout("<#E::" + type + "::" + fqn + ">");
  }

  protected static ResolveTask decision(TaskResolutionType type) {
    return new ResolveTask().withResolutionType(type).withComment("Ontology review decision");
  }

  protected static OntologyRelease current(OntologyRelease release) {
    return SdkClients.adminClient().ontologyReleases().get(release.getId());
  }

  protected static Ontology current(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologies()
        .get(ontology.getId().toString(), "owners,reviewers");
  }
}
