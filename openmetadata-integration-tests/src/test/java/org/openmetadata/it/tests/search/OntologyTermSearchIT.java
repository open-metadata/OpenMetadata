package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

@ExtendWith(TestNamespaceExtension.class)
class OntologyTermSearchIT {
  private static final String ALIAS = "ontologyTerms";

  @Test
  void findsOnlyActiveTermsAndRefreshesBindingsAndDeletion(TestNamespace ns) {
    final String purchase = RankingSupport.uniqueTerm(ns);
    final var ontology = createOntology(ns);
    try {
      final var order = createOrder(ontology, purchase);
      final var property = createProperty(ontology, order);
      assertThat(find(ALIAS, purchase, order)).isNull();

      activate(ontology);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () -> {
                assertThat(find(ALIAS, "Order", order)).isNotNull();
                assertThat(find(ALIAS, purchase, order)).isNotNull();
                assertThat(find(ALIAS, "tracking", property).path("domainLabels").get(0).asText())
                    .isEqualTo("Order");
                assertThat(find("all", purchase, order)).isNull();
              });

      editDraft(order);
      assertThat(find(ALIAS, "shipment", order)).isNull();
      assertThat(find(ALIAS, purchase, order)).isNotNull();

      final var table = createTable(ns);
      bind(order, table, List.of(), 0);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () ->
                  assertThat(boundAssets(purchase, order))
                      .containsExactly(table.getFullyQualifiedName()));
      bind(
          order,
          table,
          List.of(
              new OntologyColumnBinding()
                  .withPropertyId(property.getId())
                  .withColumnPath(List.of("code"))),
          1);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () ->
                  assertThat(boundAssets(purchase, order))
                      .containsExactlyInAnyOrder(
                          table.getFullyQualifiedName(),
                          table.getColumns().getFirst().getFullyQualifiedName()));

      SdkClients.adminClient().ontologyProperties().delete(property.getId());
      SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.DELETE, "/v1/ontologyConcepts/" + order.getId(), null, Void.class);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertThat(find(ALIAS, purchase, order)).isNull());
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/ontologyConcepts/restore",
              new RestoreEntity().withId(order.getId()),
              OntologyConcept.class);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertThat(find(ALIAS, purchase, order)).isNotNull());
    } finally {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/ontologies/" + ontology.getId() + "?recursive=true",
              null,
              Void.class);
    }
  }

  private static void editDraft(OntologyConcept term) {
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "replace").put("path", "/description").put("value", "A shipment");
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PATCH, "/v1/ontologyConcepts/" + term.getId(), patch, OntologyConcept.class);
  }

  private static Ontology createOntology(TestNamespace ns) {
    return SdkClients.adminClient()
        .ontologies()
        .create(
            new CreateOntology()
                .withName(ns.prefix("SearchOntology"))
                .withIri(URI.create("https://example.org/" + ns.shortPrefix()))
                .withNamespace(URI.create("https://example.org/" + ns.shortPrefix() + "/")));
  }

  private static OntologyConcept createOrder(Ontology ontology, String purchase) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Order")
                .withDescription("One " + purchase + " by a customer")
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withOntology(ontology.getFullyQualifiedName()));
  }

  private static OntologyProperty createProperty(Ontology ontology, OntologyConcept order) {
    return SdkClients.adminClient()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("code")
                .withDescription("The tracking number")
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(order.getIri()))
                .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string")))
                .withOntology(ontology.getFullyQualifiedName()));
  }

  private static void activate(Ontology ontology) {
    final var ontologies = SdkClients.adminClient().ontologies();
    final var state = ontologies.state(ontology.getId());
    final var release =
        ontologies.capture(
            ontology.getId(),
            new CaptureOntologyRelease().withExpectedWorkingRevision(state.getWorkingRevision()));
    ontologies.activate(
        ontology.getId(),
        new ActivateOntologyRelease()
            .withReleaseId(release.getId())
            .withExpectedActivationRevision(state.getActivationRevision()));
  }

  private static Table createTable(TestNamespace ns) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("orders"))
                .withDatabaseSchema(
                    DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("code").withDataType(ColumnDataType.STRING))));
  }

  private static void bind(
      OntologyConcept concept, Table table, List<OntologyColumnBinding> columns, long revision) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/ontologyConcepts/" + concept.getId() + "/bindings",
            new UpdateOntologyConceptBinding()
                .withExpectedRevision(revision)
                .withAsset(
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TABLE)
                        .withAssetId(table.getId())
                        .withColumns(columns)),
            OntologyConceptBindingsResponse.class);
  }

  private static List<String> boundAssets(String query, OntologyConcept term) {
    final var hit = find(ALIAS, query, term);
    assertThat(hit).isNotNull();
    return StreamSupport.stream(hit.path("boundAssets").spliterator(), false)
        .map(JsonNode::asText)
        .toList();
  }

  private static JsonNode find(String alias, String query, EntityInterface<?> term) {
    final var response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/search/query?index=" + alias + "&q=" + query + "&size=100",
                null,
                JsonNode.class);
    for (var hit : response.path("hits").path("hits")) {
      final var source = hit.path("_source");
      if (term.getId().toString().equals(source.path("id").asText())) {
        return source;
      }
    }
    return null;
  }
}
