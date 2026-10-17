package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyAxiomIT extends BaseOntologyApprovalIT {
  private static final URI CUSTOMER = URI.create("https://example.org/model/Customer");
  private static final URI PARTY = URI.create("https://example.org/model/Party");
  private static final URI PROPERTY = URI.create("https://example.org/model/knows");

  @Test
  void axiomsBelongToOntologiesAndHaveNoSeparateApproval(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    var service = SdkClients.adminClient().ontologyAxioms();
    OntologyAxiom axiom = service.create(axiomRequest(ontology));
    assertEquals(ontology.getId(), axiom.getOntology().getId());
    var stored = service.get(axiom.getId().toString());
    assertEquals(ontology.getId(), stored.getOntology().getId());
    Ontology other = createModel(ns, "other");
    service.create(axiomRequest(other));
    var page = service.list(new ListParams().addFilter("ontologyId", ontology.getId().toString()));
    assertEquals(
        List.of(axiom.getId()), page.getData().stream().map(OntologyAxiom::getId).toList());
  }

  @Test
  void contentEditsAdvanceWorkingStateWithoutChangingAnApprovedRelease(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    var service = SdkClients.adminClient().ontologyAxioms();
    OntologyAxiom axiom = service.create(axiomRequest(ontology));
    OntologyRelease release = capture(ontology);
    var review = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(review.getId().toString(), decision(TaskResolutionType.Approved));
    long revision = state(ontology).getWorkingRevision();
    service.update(
        axiom.getId(),
        axiom.withExpressions(
            List.of(namedClass(URI.create("http://www.w3.org/2002/07/owl#Thing")))));
    assertTrue(state(ontology).getWorkingRevision() > revision);
    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    assertEquals(release.getContentDigest(), current(release).getContentDigest());
  }

  @Test
  void writesCannotGrantApprovalOrMoveAnAxiom(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    Ontology other = createModel(ns, "other");
    var service = SdkClients.adminClient().ontologyAxioms();
    OntologyAxiom axiom = service.create(axiomRequest(ontology));
    var statusPatch = JsonUtils.getObjectMapper().createArrayNode();
    statusPatch
        .addObject()
        .put("op", "replace")
        .put("path", "/entityStatus")
        .put("value", "Approved");
    service.patch(axiom.getId(), statusPatch);
    assertNull(service.get(axiom.getId().toString()).getEntityStatus());
    var ownerPatch = JsonUtils.getObjectMapper().createArrayNode();
    ownerPatch
        .addObject()
        .put("op", "replace")
        .put("path", "/ontology")
        .set("value", JsonUtils.getObjectMapper().valueToTree(other.getEntityReference()));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> service.patch(axiom.getId(), ownerPatch))
            .getStatusCode());
  }

  @Test
  void releasesFreezeAxiomsAcrossUpdatesAndDeletion(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    var client = SdkClients.adminClient();
    OntologyAxiom axiom = client.ontologyAxioms().create(axiomRequest(ontology));
    OntologyRelease release =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/releases",
                new CaptureOntologyRelease()
                    .withExpectedWorkingRevision(state(ontology).getWorkingRevision()),
                OntologyRelease.class);
    assertEquals(4, release.getMemberCount());
    client.ontologyAxioms().update(axiom.getId(), axiom.withDescription("Later working text"));
    client.ontologyAxioms().delete(axiom.getId().toString(), Map.of("hardDelete", "true"));
    OntologyReleaseMember member =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/members/AXIOM/" + axiom.getId(),
                null,
                OntologyReleaseMember.class);
    assertEquals("Every customer is a party", member.getPayload().path("description").asText());
    assertEquals(
        ontology.getId().toString(), member.getPayload().path("ontology").path("id").asText());
  }

  @Test
  void previewRequiresReadAccessToItsOwningOntology(TestNamespace ns) {
    final var ontology = createModel(ns, "privateOntology");
    try (final var fixtures = new RdfAccessFixtures("preview" + ns.shortPrefix())) {
      final var create = fixtures.allowRole(MetadataOperation.CREATE, Entity.ONTOLOGY_AXIOM);
      final var deny = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY);
      final var client =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("editor", List.of(create.getId(), deny.getId())))
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> client.ontologyAxioms().validate(axiomRequest(ontology)))
              .getStatusCode());
    }
  }

  @Test
  void propertyChecksUseOnlyTheOwningOntology(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    Ontology other = createModel(ns, "other");
    var client = SdkClients.adminClient();
    var localProperty = client.ontologyProperties().create(propertyRequest(ontology));
    client
        .ontologyProperties()
        .create(
            propertyRequest(other)
                .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE)));
    var restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(PROPERTY)
            .withRestrictionKind(OntologyRestrictionKind.EXACT)
            .withCardinality(1)
            .withFiller(namedClass(PARTY));
    var request = axiomRequest(ontology).withExpressions(List.of(restriction));
    assertTrue(client.ontologyAxioms().validate(request).getValid());
    client
        .ontologyProperties()
        .update(
            localProperty.getId(),
            localProperty.withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE)));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> client.ontologyAxioms().create(request))
            .getStatusCode());
  }

  @Test
  void vocabularyChecksAreScopedAndPreserveExactIriSpelling(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    Ontology other = createModel(ns, "other");
    var service = SdkClients.adminClient().ontologyAxioms();
    service.create(axiomRequest(other).withAxiomType(OntologyAxiomType.CLASS_ASSERTION));
    OntologyAxiom axiom = service.create(axiomRequest(ontology));
    assertEquals(CUSTOMER.toString(), axiom.getSubjectIri().toString());
    URI alternate = URI.create("HTTPS://EXAMPLE.org/model/Customer");
    OntologyAxiom individual =
        service.create(
            axiomRequest(ontology)
                .withName("Individual")
                .withAxiomType(OntologyAxiomType.CLASS_ASSERTION)
                .withSubjectIri(alternate));
    assertEquals(alternate.toString(), individual.getSubjectIri().toString());
    assertNotEquals(axiom.getSubjectIri().toString(), individual.getSubjectIri().toString());
    OntologyAxiom punned =
        service.create(
            axiomRequest(ontology)
                .withName("CustomerCategory")
                .withAxiomType(OntologyAxiomType.CLASS_ASSERTION));
    assertEquals(axiom.getSubjectIri().toString(), punned.getSubjectIri().toString());
    assertNotEquals(axiom.getId(), punned.getId());
  }

  @Test
  void assertionsCannotChangeTheDeclaredPropertyKind(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    var client = SdkClients.adminClient();
    client
        .ontologyProperties()
        .create(propertyRequest(ontology).withKind(OntologyPropertyKind.DATA));
    CreateOntologyAxiom request =
        axiomRequest(ontology)
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
            .withExpressions(List.of())
            .withPropertyIri(PROPERTY)
            .withTargetIri(PARTY);
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> client.ontologyAxioms().create(request))
            .getStatusCode());
  }

  @Test
  void nativeAxiomHistoryAndRestorationRetainOwnership(TestNamespace ns) {
    Ontology ontology = createModel(ns, "reviewedOntology");
    var service = SdkClients.adminClient().ontologyAxioms();
    OntologyAxiom axiom = service.create(axiomRequest(ontology));
    service.update(axiom.getId(), axiom.withDescription("Updated"));
    assertEquals(
        "Every customer is a party",
        service.getVersion(axiom.getId().toString(), 0.1).getDescription());
    assertEquals(2, service.getVersionList(axiom.getId()).getVersions().size());
    service.delete(axiom.getId().toString());
    service.restore(axiom.getId());
    assertEquals(ontology.getId(), service.get(axiom.getId().toString()).getOntology().getId());
  }

  private static Ontology createModel(TestNamespace ns, String name) {
    final var ontology = createOntology(ns, name);
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    return ontology;
  }

  private static CreateOntologyAxiom axiomRequest(Ontology ontology) {
    return new CreateOntologyAxiom()
        .withName("CustomerIsParty")
        .withDisplayName("Customer is a Party")
        .withDescription("Every customer is a party")
        .withOntology(ontology.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(CUSTOMER)
        .withProvenance(RelationProvenance.MANUAL)
        .withExpressions(List.of(namedClass(PARTY)));
  }

  private static CreateOntologyProperty propertyRequest(Ontology ontology) {
    return new CreateOntologyProperty()
        .withName("knows")
        .withOntology(ontology.getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(PROPERTY);
  }

  private static OntologyExpression namedClass(URI iri) {
    return new OntologyExpression().withKind(OntologyExpressionKind.NAMED_CLASS).withClassIri(iri);
  }

  private static OntologyState state(Ontology ontology) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/state",
            null,
            OntologyState.class);
  }
}
