package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyPrefix;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.ontology.OntologyService;

@Execution(ExecutionMode.CONCURRENT)
public class IndependentOntologyResourceIT extends BaseOntologyIT<Ontology, CreateOntology> {
  @Test
  void importsAreExplicitlyUnsupported(TestNamespace ns) {
    Ontology imported = createEntity(createRequest(ns.prefix("imported"), ns));
    ns.trackRoot("ontology", imported);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    createEntity(
                        createMinimalRequest(ns)
                            .withImports(List.of(imported.getEntityReference()))))
            .getStatusCode());
    Ontology root = createEntity(createMinimalRequest(ns));
    ns.trackRoot("ontology", root);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    patchEntity(
                        root.getId().toString(),
                        root.withImports(List.of(imported.getEntityReference()))))
            .getStatusCode());
    assertEquals(List.of(), getEntity(root.getId().toString()).getImports());
  }

  @Test
  void prefixesRequireUniqueNamesAndExactNamespaces(TestNamespace ns) {
    OntologyPrefix first =
        new OntologyPrefix().withPrefix("ex").withNamespace(URI.create("HTTPS://EXAMPLE.org/客户#"));
    OntologyPrefix second =
        new OntologyPrefix().withPrefix("EX").withNamespace(URI.create("https://example.org/客户#"));
    CreateOntology request = createMinimalRequest(ns).withPrefixes(List.of(first, second));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    second.withPrefix("other").withNamespace(first.getNamespace());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    second.withNamespace(URI.create("relative"));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    second.withNamespace(URI.create("https://example.org/客户#"));
    Ontology created = createEntity(request);
    assertEquals(
        List.of(first.getNamespace().toString(), second.getNamespace().toString()),
        getEntity(created.getId().toString()).getPrefixes().stream()
            .map(prefix -> prefix.getNamespace().toString())
            .toList());
  }

  @Override
  protected OntologyService entityService() {
    return SdkClients.adminClient().ontologies();
  }

  @Override
  protected CreateOntology createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("ontology"), ns);
  }

  @Override
  protected CreateOntology createRequest(String name, TestNamespace ns) {
    return new CreateOntology()
        .withName(name)
        .withDescription("Ontology definition")
        .withIri(definitionIri(name, ns))
        .withNamespace(URI.create("https://example.org/ontology/"));
  }

  @Override
  protected Ontology createEntity(CreateOntology request) {
    return SdkClients.adminClient().ontologies().create(request);
  }

  @Override
  protected Ontology getEntity(String id) {
    return SdkClients.adminClient().ontologies().get(id);
  }

  @Override
  protected Ontology getEntityByName(String name) {
    return SdkClients.adminClient().ontologies().getByName(name);
  }

  @Override
  protected ListResponse<Ontology> listEntities(ListParams params) {
    return SdkClients.adminClient().ontologies().list(params);
  }

  @Override
  protected Ontology patchEntity(String id, Ontology entity) {
    return SdkClients.adminClient().ontologies().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().ontologies().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().ontologies().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .ontologies()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "ontology";
  }

  @Override
  protected String getResourcePath() {
    return "/v1/ontologies/";
  }

  @Override
  protected void validateCreatedEntity(Ontology entity, CreateOntology request) {
    assertEquals(request.getIri(), entity.getIri());
  }
}
