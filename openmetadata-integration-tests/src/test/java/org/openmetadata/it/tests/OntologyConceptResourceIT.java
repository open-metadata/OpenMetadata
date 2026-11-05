package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.ontology.OntologyConceptService;

@Execution(ExecutionMode.CONCURRENT)
public class OntologyConceptResourceIT
    extends BaseOntologyIT<OntologyConcept, CreateOntologyConcept> {
  @Override
  protected OntologyConceptService entityService() {
    return SdkClients.adminClient().ontologyConcepts();
  }

  @Override
  protected CreateOntologyConcept createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("ontologyConcept"), ns);
  }

  @Override
  protected CreateOntologyConcept createRequest(String name, TestNamespace ns) {
    return new CreateOntologyConcept()
        .withName(name)
        .withDescription("Ontology definition")
        .withIri(definitionIri(name, ns))
        .withOntology(parent(ns).getFullyQualifiedName())
        .withConceptType(OntologyConceptType.OWL_CLASS);
  }

  private static Ontology parent(TestNamespace ns) {
    Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .upsert(
                new CreateOntology()
                    .withName(ns.prefix("ontology"))
                    .withIri(URI.create("https://example.org/ontology/" + ns.shortPrefix()))
                    .withNamespace(URI.create("https://example.org/ontology/")));
    return ns.trackRoot("ontology", ontology);
  }

  @Override
  protected OntologyConcept createEntity(CreateOntologyConcept request) {
    return SdkClients.adminClient().ontologyConcepts().create(request);
  }

  @Override
  protected OntologyConcept getEntity(String id) {
    return SdkClients.adminClient().ontologyConcepts().get(id);
  }

  @Override
  protected OntologyConcept getEntityByName(String name) {
    return SdkClients.adminClient().ontologyConcepts().getByName(name);
  }

  @Override
  protected ListResponse<OntologyConcept> listEntities(ListParams params) {
    return SdkClients.adminClient().ontologyConcepts().list(params);
  }

  @Override
  protected OntologyConcept patchEntity(String id, OntologyConcept entity) {
    return SdkClients.adminClient().ontologyConcepts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().ontologyConcepts().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().ontologyConcepts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .ontologyConcepts()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "ontologyConcept";
  }

  @Override
  protected String getResourcePath() {
    return "/v1/ontologyConcepts/";
  }

  @Override
  protected void validateCreatedEntity(OntologyConcept entity, CreateOntologyConcept request) {
    assertEquals(request.getIri(), entity.getIri());
  }
}
