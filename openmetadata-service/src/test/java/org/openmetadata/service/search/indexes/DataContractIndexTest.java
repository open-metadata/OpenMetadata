package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.TermsOfUse;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchRepository;

class DataContractIndexTest {
  private static final List<String> FREE_FORM_FIELDS =
      List.of(
          "schema",
          "semantics",
          "qualityExpectations",
          "odcsQualityRules",
          "odcsElementExtensions",
          "odcsPreservedFields",
          "contractUpdates",
          "sla",
          "security",
          "termsOfUse");

  private static SearchRepository previousRepository;

  @BeforeAll
  static void initSearchRepository() {
    previousRepository = Entity.getSearchRepository();
    Entity.setSearchRepository(mock(SearchRepository.class));
  }

  @AfterAll
  static void restoreSearchRepository() {
    Entity.setSearchRepository(previousRepository);
  }

  private static EntityReference ref(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName("svc.db.schema." + name);
  }

  private static DataContract contract() {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("orders_contract")
        .withFullyQualifiedName("svc.db.schema.orders.dataContract_orders_contract")
        .withEntity(ref(Entity.TABLE, "orders"))
        .withOwners(List.of(ref(Entity.USER, "alice")));
  }

  @Test
  void buildDoc_setsEntityReferenceWithDisplayName() {
    Map<String, Object> doc = new DataContractIndex(contract()).buildSearchIndexDoc();

    EntityReference entity = (EntityReference) doc.get("entity");
    assertEquals(Entity.TABLE, entity.getType());
    assertEquals("orders", entity.getDisplayName(), "displayName falls back to name");
    assertEquals(Entity.DATA_CONTRACT, doc.get("entityType"));
    assertEquals(List.of("alice"), doc.get("ownerName"));
  }

  @Test
  void buildDoc_minimalContract_hasNoNulls() {
    DataContract minimal =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("c")
            .withFullyQualifiedName("svc.db.schema.t.dataContract_c")
            .withEntity(ref(Entity.TABLE, "t"));

    Map<String, Object> doc = new DataContractIndex(minimal).buildSearchIndexDoc();

    assertNull(doc.get("testSuite"));
    assertEquals(List.of(), doc.get("owners"));
    assertEquals(List.of(), doc.get("reviewers"));
  }

  @Test
  void buildDoc_excludesFreeFormBlocks() {
    DataContract heavy =
        contract()
            .withOdcsPreservedFields(
                new ObjectMapper()
                    .createObjectNode()
                    .putObject("arbitraryFutureFields")
                    .put("vendorKey", true))
            .withSla(new ContractSLA())
            .withSecurity(new ContractSecurity())
            .withTermsOfUse(new TermsOfUse().withContent("terms"));

    Map<String, Object> doc = new DataContractIndex(heavy).buildSearchIndexDoc();

    for (String field : FREE_FORM_FIELDS) {
      assertFalse(doc.containsKey(field), field + " must not reach the search doc");
    }
  }

  @Test
  void everyDocKeyIsMapped() throws Exception {
    JsonNode properties;
    try (InputStream in =
        getClass().getResourceAsStream("/elasticsearch/en/data_contract_index_mapping.json")) {
      properties = new ObjectMapper().readTree(in).path("mappings").path("properties");
    }
    Set<String> mapped = new HashSet<>();
    properties.fieldNames().forEachRemaining(mapped::add);

    Map<String, Object> doc = new DataContractIndex(contract()).buildSearchIndexDoc();

    Set<String> unmapped = new HashSet<>(doc.keySet());
    unmapped.removeAll(mapped);
    assertTrue(unmapped.isEmpty(), "doc keys missing from mapping (dynamic mapping): " + unmapped);
  }

  @Test
  @SuppressWarnings("unchecked")
  void buildDoc_copiesGovernedEntityDomainsWithDisplayName() {
    DataContract dc = contract();
    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("finance")
            .withFullyQualifiedName("finance")
            .withInherited(true);
    Table governed = new Table().withId(dc.getEntity().getId()).withDomains(List.of(domain));
    SearchRepository searchRepository = Entity.getSearchRepository();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.isTimeSeriesEntity(Entity.TABLE)).thenReturn(false);
      entityMock.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
      entityMock
          .when(() -> Entity.entityHasField(Entity.TABLE, Entity.FIELD_DOMAINS))
          .thenReturn(true);
      entityMock
          .when(() -> Entity.getEntity(dc.getEntity(), Entity.FIELD_DOMAINS, Include.ALL))
          .thenReturn(governed);

      Map<String, Object> doc = new DataContractIndex(dc).buildSearchIndexDoc();

      List<EntityReference> indexedDomains = (List<EntityReference>) doc.get(Entity.FIELD_DOMAINS);
      assertEquals(1, indexedDomains.size());
      assertEquals(domain.getId(), indexedDomains.getFirst().getId());
      assertEquals("finance", indexedDomains.getFirst().getDisplayName());
      assertEquals("finance", indexedDomains.getFirst().getFullyQualifiedName());
      assertTrue(Boolean.TRUE.equals(indexedDomains.getFirst().getInherited()));
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void buildDoc_usesPrefetchedDomainsWithoutPerEntityLookup() {
    DataContract dc = contract();
    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("sales")
            .withFullyQualifiedName("sales");
    SearchRepository searchRepository = Entity.getSearchRepository();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      Map<String, Object> docWithDomain =
          new DataContractIndex(dc)
              .buildSearchIndexDoc(DocBuildContext.withDomains(List.of(domain)));
      Map<String, Object> docDomainless =
          new DataContractIndex(dc).buildSearchIndexDoc(DocBuildContext.withDomains(List.of()));

      List<EntityReference> domains =
          (List<EntityReference>) docWithDomain.get(Entity.FIELD_DOMAINS);
      assertEquals(1, domains.size());
      assertEquals(domain.getId(), domains.getFirst().getId());
      assertEquals("sales", domains.getFirst().getDisplayName());
      assertEquals(List.of(), docDomainless.get(Entity.FIELD_DOMAINS));
      entityMock.verify(() -> Entity.getEntity(any(EntityReference.class), any(), any()), never());
    }
  }

  @Test
  void buildDoc_failsClosedWhenGovernedEntityIsMissing() {
    DataContract dc = contract();
    SearchRepository searchRepository = Entity.getSearchRepository();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.isTimeSeriesEntity(Entity.TABLE)).thenReturn(false);
      entityMock.when(() -> Entity.hasEntityRepository(Entity.TABLE)).thenReturn(true);
      entityMock
          .when(() -> Entity.entityHasField(Entity.TABLE, Entity.FIELD_DOMAINS))
          .thenReturn(true);
      entityMock
          .when(() -> Entity.getEntity(dc.getEntity(), Entity.FIELD_DOMAINS, Include.ALL))
          .thenThrow(EntityNotFoundException.byId(dc.getEntity().getId().toString()));

      assertThrows(
          EntityNotFoundException.class, () -> new DataContractIndex(dc).buildSearchIndexDoc());
    }
  }

  @Test
  void prefetchGovernedEntityDomains_batchesByTypeAndLeavesMissingTargetsForFallback() {
    DataContract tableContract = contract();
    DataContract missingTableContract = contract();
    DataContract topicContract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("events_contract")
            .withFullyQualifiedName("kafka.events.dataContract_events_contract")
            .withEntity(ref(Entity.TOPIC, "events"));
    EntityReference finance =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("finance")
            .withFullyQualifiedName("finance");
    Table foundTable =
        new Table().withId(tableContract.getEntity().getId()).withDomains(List.of(finance));
    Topic domainlessTopic = new Topic().withId(topicContract.getEntity().getId());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.isTimeSeriesEntity(any())).thenReturn(false);
      entityMock.when(() -> Entity.hasEntityRepository(any())).thenReturn(true);
      entityMock
          .when(() -> Entity.entityHasField(any(), eq(Entity.FIELD_DOMAINS)))
          .thenReturn(true);
      entityMock
          .when(
              () ->
                  Entity.getEntities(
                      eq(List.of(tableContract.getEntity(), missingTableContract.getEntity())),
                      eq(Entity.FIELD_DOMAINS),
                      eq(Include.ALL)))
          .thenReturn(List.of(foundTable));
      entityMock
          .when(
              () ->
                  Entity.getEntities(
                      eq(List.of(topicContract.getEntity())),
                      eq(Entity.FIELD_DOMAINS),
                      eq(Include.ALL)))
          .thenReturn(List.of(domainlessTopic));

      Map<UUID, List<EntityReference>> prefetched =
          DataContractIndex.prefetchGovernedEntityDomains(
              List.of(tableContract, missingTableContract, topicContract));

      assertNotNull(prefetched);
      assertEquals(List.of(finance), prefetched.get(tableContract.getId()));
      assertEquals(List.of(), prefetched.get(topicContract.getId()));
      assertFalse(
          prefetched.containsKey(missingTableContract.getId()),
          "missing target must stay unprefetched so buildSearchIndexDoc fails closed");
    }
  }

  @Test
  void prefetchGovernedEntityDomains_isolatesPerTargetTypeFailure() {
    DataContract tableContract = contract();
    DataContract topicContract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("events_contract")
            .withFullyQualifiedName("kafka.events.dataContract_events_contract")
            .withEntity(ref(Entity.TOPIC, "events"));
    EntityReference finance =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("finance")
            .withFullyQualifiedName("finance");
    Topic foundTopic =
        new Topic().withId(topicContract.getEntity().getId()).withDomains(List.of(finance));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.isTimeSeriesEntity(any())).thenReturn(false);
      entityMock.when(() -> Entity.hasEntityRepository(any())).thenReturn(true);
      entityMock
          .when(() -> Entity.entityHasField(any(), eq(Entity.FIELD_DOMAINS)))
          .thenReturn(true);
      entityMock
          .when(() -> Entity.getEntities(anyList(), eq(Entity.FIELD_DOMAINS), eq(Include.ALL)))
          .thenAnswer(
              invocation -> {
                List<EntityReference> refs = invocation.getArgument(0);
                if (Entity.TABLE.equals(refs.getFirst().getType())) {
                  throw new IllegalStateException("transient db failure");
                }
                return List.of(foundTopic);
              });

      Map<UUID, List<EntityReference>> prefetched =
          DataContractIndex.prefetchGovernedEntityDomains(List.of(tableContract, topicContract));

      assertNotNull(prefetched);
      assertFalse(prefetched.containsKey(tableContract.getId()));
      assertEquals(List.of(finance), prefetched.get(topicContract.getId()));
    }
  }
}
