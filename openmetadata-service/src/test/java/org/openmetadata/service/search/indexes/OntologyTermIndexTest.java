package org.openmetadata.service.search.indexes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyPropertyRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.SearchIndexFactory;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.util.EntityUtil.Fields;

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
    final var assetId = UUID.randomUUID().toString();
    final var document =
        new OntologyTermIndex(index.term(), List.of(assetId), List.of(), List.of())
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
        .containsEntry("boundAssetIds", List.of(assetId))
        .doesNotContainKey("boundAssets")
        .containsEntry("deleted", false)
        .containsEntry("updatedAt", 123L)
        .containsKeys("ontology", "fingerprint", "embedding");
    assertThat(document.get("textToEmbed").toString()).contains("Order", "purchase", "Transaction");
  }

  @Test
  void indexesThePropertyDomainAndRange() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyproperty", Entity.ONTOLOGY_PROPERTY);
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
        new OntologyTermIndex(index.term(), List.of(), List.of("Purchase order"), List.of("string"))
            .buildSearchIndexDoc();
    document.putAll(propertyEmbedding(term));
    assertThat(document)
        .containsEntry("kind", "data")
        .containsEntry("domain", List.of(ORDER_IRI.toString()))
        .containsEntry("range", List.of(STRING_IRI.toString()))
        .containsEntry("domainLabels", List.of("Purchase order"))
        .containsEntry("rangeLabels", List.of("string"))
        .containsKeys("ontology", "fingerprint");
    assertThat(document.get("textToEmbed").toString())
        .contains("Order code", "The reference number", "Purchase order", "string");
  }

  @Test
  void activeIndexUsesReleasedTextAndLiveOwners() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.putIfAbsent(
        "ontologyproperty", Entity.ONTOLOGY_PROPERTY);
    final var id = UUID.randomUUID();
    final var reference = new EntityReference().withId(id).withType(Entity.ONTOLOGY_PROPERTY);
    final var owner = new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER);
    final var working =
        new OntologyProperty().withId(id).withName("draft").withOwners(List.of(owner));
    final var released =
        new OntologyProperty().withId(id).withName("released").withKind(OntologyPropertyKind.DATA);
    final var release =
        new OntologyReleaseMember()
            .withMemberKind(MemberKind.PROPERTY)
            .withReleaseId(UUID.randomUUID())
            .withMemberId(id)
            .withPayload(JsonUtils.valueToTree(released));
    final var repository = mock(OntologyPropertyRepository.class);
    final var fields = new Fields(Set.of("owners"));
    when(repository.getOnlySupportedFields("owners")).thenReturn(fields);
    doReturn(List.of(working)).when(repository).get(null, List.of(id), fields, Include.NON_DELETED);
    final var db = mock(CollectionDAO.class);
    final var releases = mock(OntologyReleaseDAO.class);
    when(db.ontologyReleaseDAO()).thenReturn(releases);

    try (var entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getCollectionDAO).thenReturn(db);
      entity
          .when(() -> Entity.getEntityRepository(Entity.ONTOLOGY_PROPERTY))
          .thenReturn(repository);
      assertThat(OntologyTermSearch.activeIndex(reference)).isNull();
      when(releases.listActiveMembers(MemberKind.PROPERTY.value(), List.of(id.toString())))
          .thenReturn(List.of(release));
      final var active = OntologyTermSearch.activeIndex(reference);
      assertThat(active.term().getName()).isEqualTo("released");
      assertThat(active.term().getOwners()).containsExactly(owner);
      release.setPayload(JsonUtils.valueToTree(released.withDeprecated(true)));
      assertThat(OntologyTermSearch.activeIndex(reference)).isNull();
    }
  }

  private static Map<String, Object> propertyEmbedding(OntologyProperty property) {
    final var db = mock(CollectionDAO.class);
    final var releases = mock(OntologyReleaseDAO.class);
    final var releaseId = UUID.randomUUID();
    when(db.ontologyReleaseDAO()).thenReturn(releases);
    when(releases.listActiveMembers(
            MemberKind.PROPERTY.value(), List.of(property.getId().toString())))
        .thenReturn(List.of(new OntologyReleaseMember().withReleaseId(releaseId)));
    final var order =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("Order")
            .withDisplayName("Purchase order")
            .withIri(ORDER_IRI);
    when(releases.listConceptsByIri(
            releaseId, List.of(ORDER_IRI.toString(), STRING_IRI.toString())))
        .thenReturn(
            List.of(
                new OntologyReleaseMember()
                    .withMemberId(order.getId())
                    .withMemberKind(MemberKind.CONCEPT)
                    .withPayload(JsonUtils.valueToTree(order))));
    try (var entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getCollectionDAO).thenReturn(db);
      return VectorDocBuilder.buildEmbeddingFields(property, new TestEmbeddingClient());
    }
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
