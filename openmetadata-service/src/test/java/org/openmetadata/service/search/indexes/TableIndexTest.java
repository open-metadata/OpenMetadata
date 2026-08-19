package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class TableIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void aliasesArePutOnTheSearchDocument() {
    Table table =
        new Table()
            .withName("orders")
            .withFullyQualifiedName("svc.analytics_master.dbo.orders")
            .withAliases(List.of("svc.analytics_core.dbo.orders"));

    Map<String, Object> doc = new TableIndex(table).buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(List.of("svc.analytics_core.dbo.orders"), doc.get("aliases"));
  }

  @Test
  void aliasesAreSearchableWithABoost() {
    assertEquals(5.0f, TableIndex.getFields().get("aliases"));
  }
}
