package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReferenceIT extends BaseOntologyApprovalIT {
  @Test
  void nativeWritesUpdateReferenceImpactAcrossCreatePatchDeleteAndRestore(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    URI target = URI.create("urn:example:Customer");
    OntologyProperty property = property(ontology, target);
    var concept =
        SdkClients.adminClient()
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("MappedCustomer")
                    .withConceptType(OntologyConceptType.BOTH)
                    .withOntology(ontology.getFullyQualifiedName())
                    .withConceptMappings(
                        List.of(
                            new ConceptMapping()
                                .withConceptIri(target)
                                .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH))));
    declareClass(ontology, "PremiumCustomer", URI.create("urn:example:PremiumCustomer"));
    OntologyAxiom axiom =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologyAxioms",
                new CreateOntologyAxiom()
                    .withName("CustomerSubclass")
                    .withDisplayName("Customer subclass")
                    .withDescription("Reference impact test")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                    .withProvenance(RelationProvenance.MANUAL)
                    .withSubjectIri(URI.create("urn:example:PremiumCustomer"))
                    .withExpressions(
                        List.of(
                            new OntologyExpression()
                                .withKind(OntologyExpressionKind.NAMED_CLASS)
                                .withClassIri(target))),
                OntologyAxiom.class);
    Set<UUID> sources = new HashSet<>();
    Set<String> references = new HashSet<>();
    String after = "";
    do {
      JsonNode page = references(SdkClients.adminClient(), ontology, target, "&limit=1" + after);
      assertEquals(4, page.path("paging").path("total").asInt());
      assertEquals(1, page.path("data").size());
      JsonNode reference = page.path("data").get(0);
      assertEquals(target.toString(), reference.path("iri").asText());
      sources.add(UUID.fromString(reference.path("source").path("id").asText()));
      assertTrue(
          references.add(
              reference.path("source").path("id").asText() + reference.path("role").asText()));
      String cursor = page.path("paging").path("after").asText("");
      after = cursor.isEmpty() ? "" : "&after=" + encode(cursor);
    } while (!after.isEmpty());
    assertEquals(Set.of(property.getId(), concept.getId(), axiom.getId()), sources);
    URI replacement = URI.create("urn:example:Account");
    declareClass(ontology, "Account", replacement);
    SdkClients.adminClient()
        .ontologyProperties()
        .update(property.getId(), property.withDomain(List.of(replacement)));
    assertTotal(ontology, target, 3);
    assertTotal(ontology, replacement, 1);
    SdkClients.adminClient().ontologyConcepts().delete(concept.getId());
    assertTotal(ontology, target, 2);
    SdkClients.adminClient().ontologyConcepts().restore(concept.getId());
    assertTotal(ontology, target, 3);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/ontologyAxioms/" + axiom.getId() + "?hardDelete=true",
            null,
            Void.class);
    assertTotal(ontology, target, 1);
  }

  @Test
  void referenceLookupsKeepExactIrisAndModuleBoundaries(TestNamespace ns) {
    Ontology first = createOntology(ns, "first");
    Ontology second = createOntology(ns, "second");
    URI iri = URI.create("HTTP://example.org/Customer");
    var firstProperty = property(first, iri);
    var secondProperty = property(second, iri);
    assertNotEquals(firstProperty.getId(), secondProperty.getId());
    assertTotal(first, iri, 1);
    assertTotal(second, iri, 1);
    assertTotal(first, URI.create("http://example.org/Customer"), 0);
    assertEquals(
        firstProperty.getId().toString(),
        references(SdkClients.adminClient(), first, iri, "")
            .path("data")
            .get(0)
            .path("source")
            .path("id")
            .asText());
  }

  @Test
  void impactReadsEnforceTheSourceDefinitionsPermission(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    URI iri = URI.create("urn:restricted");
    property(ontology, iri);
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("references" + ns.shortPrefix())) {
      var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_PROPERTY);
      String token = fixtures.userToken("reader", List.of(role.getId()));
      var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());
      denied.ontologies().get(ontology.getId());
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> references(denied, ontology, iri, ""))
              .getStatusCode());
    }
  }

  @Test
  void impactQueriesRejectMissingRelativeIrisAndInvalidPaging(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    for (String query :
        List.of(
            "",
            "?iri=relative",
            "?iri=urn:target&limit=0",
            "?iri=urn:target&limit=1001",
            "?iri=urn:target&after=bad-cursor")) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      SdkClients.adminClient()
                          .getHttpClient()
                          .execute(
                              HttpMethod.GET,
                              "/v1/ontologies/" + ontology.getId() + "/references" + query,
                              null,
                              JsonNode.class))
              .getStatusCode());
    }
  }

  private static OntologyProperty property(Ontology ontology, URI domain) {
    declareClass(ontology, "Domain", domain);
    return SdkClients.adminClient()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("property")
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.OBJECT)
                .withDomain(List.of(domain)));
  }

  private static JsonNode references(
      OpenMetadataClient client, Ontology ontology, URI iri, String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/"
                + ontology.getId()
                + "/references?iri="
                + encode(iri.toString())
                + query,
            null,
            JsonNode.class);
  }

  private static void assertTotal(Ontology ontology, URI iri, int expected) {
    assertEquals(
        expected,
        references(SdkClients.adminClient(), ontology, iri, "")
            .path("paging")
            .path("total")
            .asInt());
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
