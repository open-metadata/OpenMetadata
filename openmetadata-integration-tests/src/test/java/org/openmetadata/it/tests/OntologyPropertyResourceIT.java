package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.ontology.OntologyPropertyService;

@Execution(ExecutionMode.CONCURRENT)
public class OntologyPropertyResourceIT
    extends BaseOntologyIT<OntologyProperty, CreateOntologyProperty> {
  private void assertPropertyFieldRejected(OntologyProperty property, String field, Object value) {
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/" + field)
        .set("value", JsonUtils.valueToTree(value));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class, () -> entityService().patch(property.getId(), patch))
            .getStatusCode());
  }

  @Test
  void dataValuesRoundTripAndEditsCreateANewVersion(TestNamespace ns) {
    final List<OntologyLiteral> values =
        List.of(
            new OntologyLiteral()
                .withValue("01")
                .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#integer")),
            new OntologyLiteral()
                .withValue("2")
                .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#integer")));
    final OntologyProperty created =
        createEntity(
            createMinimalRequest(ns)
                .withKind(OntologyPropertyKind.DATA)
                .withEnumValues(values)
                .withUnit("kg")
                .withIsIdentifier(true));
    final OntologyProperty stored = getEntity(created.getId().toString());
    assertEquals(values, stored.getEnumValues());
    assertEquals("kg", stored.getUnit());
    assertEquals(true, stored.getIsIdentifier());
    stored.setEnumValues(List.of(values.getLast()));
    stored.setUnit("g");
    final OntologyProperty updated = entityService().update(stored.getId().toString(), stored);
    assertEquals(List.of(values.getLast()), updated.getEnumValues());
    assertEquals("g", updated.getUnit());
    assertTrue(updated.getVersion() > created.getVersion());
  }

  @Test
  void enumerationMetadataIsValidatedOnEveryWrite(TestNamespace ns) {
    final CreateOntologyProperty request =
        createMinimalRequest(ns).withEnumValues(List.of(new OntologyLiteral().withValue("Gold")));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    request.withEnumValues(List.of()).withUnit("kg");
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    request.withUnit(null).withIsIdentifier(true);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    final OntologyProperty created = createEntity(request.withKind(OntologyPropertyKind.DATA));
    created.setEnumValues(
        List.of(
            new OntologyLiteral()
                .withValue("one")
                .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#integer"))));
    assertPropertyFieldRejected(created, "enumValues", created.getEnumValues());
    created.setEnumValues(
        List.of(new OntologyLiteral().withValue("Gold"), new OntologyLiteral().withValue("Gold")));
    assertPropertyFieldRejected(created, "enumValues", created.getEnumValues());
    assertEquals(List.of(), getEntity(created.getId().toString()).getEnumValues());
  }

  @Test
  void propertyReferencesPreserveTheirExactIriSpelling(TestNamespace ns) {
    List<String> spellings =
        List.of("HTTPS://EXAMPLE.org/客户%2fOriginal", "https://example.org/客户%2fOriginal");
    List<URI> references = spellings.stream().map(URI::create).toList();
    final var request = createMinimalRequest(ns);
    declareProperties(request, references);
    final var ontology = SdkClients.adminClient().ontologies().getByName(request.getOntology());
    for (int index = 0; index < references.size(); index++) {
      BaseOntologyApprovalIT.declareClass(ontology, "Class" + index, references.get(index));
    }
    OntologyProperty created =
        createEntity(
            request
                .withDomain(references)
                .withRange(references)
                .withDisjointWith(references)
                .withInverse(references.getFirst()));
    final var chain =
        createEntity(
            new CreateOntologyProperty()
                .withName("Chain")
                .withOntology(request.getOntology())
                .withKind(OntologyPropertyKind.OBJECT)
                .withPropertyChain(references));
    OntologyProperty stored = getEntity(created.getId().toString());
    assertEquals(spellings, stored.getDomain().stream().map(URI::toString).toList());
    assertEquals(spellings, stored.getRange().stream().map(URI::toString).toList());
    assertEquals(spellings, stored.getDisjointWith().stream().map(URI::toString).toList());
    assertEquals(
        spellings,
        getEntity(chain.getId().toString()).getPropertyChain().stream()
            .map(URI::toString)
            .toList());
    assertEquals(spellings.getFirst(), stored.getInverse().toString());

    stored.setDomain(List.of(references.getLast()));
    entityService().update(stored.getId().toString(), stored);
    assertEquals(
        List.of(spellings.getLast()),
        getEntity(stored.getId().toString()).getDomain().stream().map(URI::toString).toList());
  }

  @Test
  void propertySetsRejectDuplicateIrisButChainsAllowRepetition(TestNamespace ns) {
    URI iri = URI.create("https://example.org/Customer");
    List<URI> duplicates = List.of(iri, iri);
    CreateOntologyProperty request = createMinimalRequest(ns).withDomain(duplicates);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    request.withDomain(null).withRange(duplicates);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    request.withRange(null).withDisjointWith(duplicates);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    declareProperties(request, List.of(iri));
    OntologyProperty property =
        createEntity(request.withDisjointWith(null).withPropertyChain(duplicates));
    assertEquals(duplicates, getEntity(property.getId().toString()).getPropertyChain());
  }

  @Test
  void propertyKindConstrainsItsCharacteristics(TestNamespace ns) {
    CreateOntologyProperty request =
        createMinimalRequest(ns)
            .withKind(OntologyPropertyKind.ANNOTATION)
            .withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    OntologyProperty property = createEntity(request.withKind(OntologyPropertyKind.DATA));

    property.setCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    assertPropertyFieldRejected(property, "characteristics", property.getCharacteristics());
    assertEquals(
        Set.of(RelationshipCharacteristic.FUNCTIONAL),
        getEntity(property.getId().toString()).getCharacteristics());
  }

  @Test
  void propertyChainsRequireAtLeastTwoObjectProperties(TestNamespace ns) {
    CreateOntologyProperty request =
        createMinimalRequest(ns)
            .withPropertyChain(List.of(URI.create("https://example.org/first")));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> createEntity(request)).getStatusCode());
    List<URI> chain =
        List.of(URI.create("https://example.org/first"), URI.create("https://example.org/second"));
    declareProperties(request, chain);
    OntologyProperty property = createEntity(request.withPropertyChain(chain));
    assertEquals(chain, getEntity(property.getId().toString()).getPropertyChain());
  }

  private static void declareProperties(CreateOntologyProperty owner, List<URI> iris) {
    for (int index = 0; index < iris.size(); index++) {
      SdkClients.adminClient()
          .ontologyProperties()
          .create(
              new CreateOntologyProperty()
                  .withOntology(owner.getOntology())
                  .withName("Reference" + index)
                  .withIri(iris.get(index))
                  .withKind(OntologyPropertyKind.OBJECT));
    }
  }

  @Override
  protected OntologyPropertyService entityService() {
    return SdkClients.adminClient().ontologyProperties();
  }

  @Override
  protected CreateOntologyProperty createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("ontologyProperty"), ns);
  }

  @Override
  protected CreateOntologyProperty createRequest(String name, TestNamespace ns) {
    return new CreateOntologyProperty()
        .withName(name)
        .withDescription("Ontology definition")
        .withIri(definitionIri(name, ns))
        .withOntology(parent(ns).getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT);
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
  protected OntologyProperty createEntity(CreateOntologyProperty request) {
    return SdkClients.adminClient().ontologyProperties().create(request);
  }

  @Override
  protected OntologyProperty getEntity(String id) {
    return SdkClients.adminClient().ontologyProperties().get(id);
  }

  @Override
  protected OntologyProperty getEntityByName(String name) {
    return SdkClients.adminClient().ontologyProperties().getByName(name);
  }

  @Override
  protected ListResponse<OntologyProperty> listEntities(ListParams params) {
    return SdkClients.adminClient().ontologyProperties().list(params);
  }

  @Override
  protected OntologyProperty patchEntity(String id, OntologyProperty entity) {
    return SdkClients.adminClient().ontologyProperties().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().ontologyProperties().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().ontologyProperties().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .ontologyProperties()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "ontologyProperty";
  }

  @Override
  protected String getResourcePath() {
    return "/v1/ontologyProperties/";
  }

  @Override
  protected void validateCreatedEntity(OntologyProperty entity, CreateOntologyProperty request) {
    assertEquals(request.getIri(), entity.getIri());
  }
}
