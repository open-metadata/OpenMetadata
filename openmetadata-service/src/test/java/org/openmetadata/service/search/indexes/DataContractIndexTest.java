package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

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
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.TermsOfUse;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class DataContractIndexTest {
  private static final List<String> FREE_FORM_FIELDS =
      List.of(
          "schema",
          "semantics",
          "qualityExpectations",
          "odcsQualityRules",
          "odcsElementExtensions",
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
}
