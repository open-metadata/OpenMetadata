package org.openmetadata.service.search.indexes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class OntologyTermIndexTest {
  private static final EntityReference ONTOLOGY =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.ONTOLOGY).withName("shop");
  private static final URI ORDER_IRI = URI.create("urn:shop:order");
  private static final URI STRING_IRI = URI.create("http://www.w3.org/2001/XMLSchema#string");

  @Test
  void indexesAConceptWithItsSynonymsAndBindings() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyconcept", Entity.ONTOLOGY_CONCEPT);
    final var term =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("order")
            .withDisplayName("Order")
            .withFullyQualifiedName("shop.order")
            .withDescription("One purchase by a customer")
            .withOntology(ONTOLOGY)
            .withIri(ORDER_IRI)
            .withSynonyms(Set.of("Transaction"))
            .withDeleted(false)
            .withUpdatedAt(123L);
    final var index =
        (OntologyTermIndex) new SearchIndexFactory().buildIndex(Entity.ONTOLOGY_CONCEPT, term);
    final var document =
        new OntologyTermIndex(
                index.term(),
                List.of("svc.db.schema.orders", "svc.db.schema.orders.id"),
                List.of(),
                List.of())
            .buildSearchIndexDoc();
    document.putAll(VectorDocBuilder.buildEmbeddingFields(term, new TestEmbeddingClient()));
    assertThat(document)
        .containsEntry("id", term.getId().toString())
        .containsEntry("name", "order")
        .containsEntry("displayName", "Order")
        .containsEntry("fullyQualifiedName", "shop.order")
        .containsEntry("description", "One purchase by a customer")
        .containsEntry("kind", "class")
        .containsEntry("iri", ORDER_IRI.toString())
        .containsEntry("synonyms", List.of("Transaction"))
        .containsEntry("boundAssets", List.of("svc.db.schema.orders", "svc.db.schema.orders.id"))
        .containsEntry("deleted", false)
        .containsEntry("updatedAt", 123L)
        .containsKeys("ontology", "fingerprint", "embedding");
    assertThat(document.get("textToEmbed").toString()).contains("Order", "purchase", "Transaction");
  }

  @Test
  void indexesThePropertyDomainAndRange() {
    final var term =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("code")
            .withDisplayName("Order code")
            .withFullyQualifiedName("shop.code")
            .withDescription("The reference number")
            .withOntology(ONTOLOGY)
            .withIri(URI.create("urn:shop:code"))
            .withKind(OntologyPropertyKind.DATA)
            .withDomain(List.of(ORDER_IRI))
            .withRange(List.of(STRING_IRI))
            .withDeleted(false);
    final var index =
        (OntologyTermIndex) new SearchIndexFactory().buildIndex(Entity.ONTOLOGY_PROPERTY, term);
    final var document =
        new OntologyTermIndex(index.term(), List.of(), List.of("Order"), List.of("string"))
            .buildSearchIndexDoc();
    assertThat(document)
        .containsEntry("kind", "data")
        .containsEntry("domain", List.of(ORDER_IRI.toString()))
        .containsEntry("range", List.of(STRING_IRI.toString()))
        .containsEntry("domainLabels", List.of("Order"))
        .containsEntry("rangeLabels", List.of("string"))
        .containsKey("ontology");
  }

  @Test
  void refusesToBuildADeletedDocument() {
    final var term = new OntologyConcept().withId(UUID.randomUUID()).withDeleted(true);
    final var index = new SearchIndexFactory().buildIndex(Entity.ONTOLOGY_CONCEPT, term);
    assertThatThrownBy(index::buildSearchIndexDoc).isInstanceOf(IllegalArgumentException.class);
  }

  private static final class TestEmbeddingClient extends EmbeddingClient {
    @Override
    protected float[] doEmbed(String text) {
      return new float[] {1.0f, 0.0f};
    }

    @Override
    public int getDimension() {
      return 2;
    }

    @Override
    public String getModelId() {
      return "test";
    }
  }
}
