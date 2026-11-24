package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil;

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

  /**
   * TableIndex.getFields() is never consulted by the ES/OS source-builder factories for table
   * search (only a handful of other indexes use that mechanism); the actual data-asset query is
   * built from assetTypeConfigurations[assetType=table].searchFields in searchSettings.json. This
   * test asserts on that settings-driven path instead of the dead getFields() map so alias
   * searchability is verified where it is actually enforced.
   */
  @Test
  void aliasesAreSearchableWithABoostInSearchSettings() throws IOException {
    AssetTypeConfiguration tableConfig =
        findAssetConfig(loadDefaultSearchSettingsFromFile(), "table");
    assertNotNull(tableConfig, "searchSettings.json must contain a table assetTypeConfiguration");

    FieldBoost aliasesField =
        tableConfig.getSearchFields().stream()
            .filter(field -> "aliases".equals(field.getField()))
            .findFirst()
            .orElse(null);
    assertNotNull(aliasesField, "table searchFields must include 'aliases'");
    assertEquals(5.0, aliasesField.getBoost());

    Set<String> fieldNames =
        tableConfig.getSearchFields().stream()
            .map(FieldBoost::getField)
            .collect(Collectors.toSet());
    assertTrue(
        fieldNames.contains("aliases.keyword"),
        "table searchFields must include 'aliases.keyword' for exact-FQN ranking");
    assertTrue(
        tableConfig.getHighlightFields().contains("aliases"),
        "table highlightFields must include 'aliases' so matched-alias text is returned");
  }

  private SearchSettings loadDefaultSearchSettingsFromFile() throws IOException {
    List<String> jsonDataFiles =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(
            EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
    return JsonUtils.readValue(json, SearchSettings.class);
  }

  private AssetTypeConfiguration findAssetConfig(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equalsIgnoreCase(config.getAssetType()))
        .findFirst()
        .orElse(null);
  }
}
