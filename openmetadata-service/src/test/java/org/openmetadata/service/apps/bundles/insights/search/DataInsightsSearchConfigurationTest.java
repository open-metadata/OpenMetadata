package org.openmetadata.service.apps.bundles.insights.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataAssetType;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The keys of {@code mappingFields} are typed as {@link DataAssetType}, so a key naming something
 * Data Insights does not cover cannot exist rather than merely being wrong. These tests pin that the
 * shipped file still binds to that stricter shape, and that a misspelling fails at load.
 */
class DataInsightsSearchConfigurationTest {

  @Test
  void theShippedConfigBindsToTypedKeys() {
    DataInsightsSearchConfiguration.MappingFields mappingFields = readShippedConfig();

    assertFalse(mappingFields.getCommon().isEmpty(), "common attributes are missing");
    assertTrue(
        mappingFields.getByType().containsKey(DataAssetType.TABLE),
        "table attributes should have parsed: " + mappingFields.getByType().keySet());
    assertTrue(
        mappingFields.getByType().containsKey(DataAssetType.METRIC),
        "metric attributes should have parsed: " + mappingFields.getByType().keySet());
  }

  @Test
  void anUnknownEntityTypeFailsAtLoadAndNamesTheOffendingKey() {
    String withTypo = "{\"mappingFields\": {\"common\": [\"id\"], \"tabel\": [\"columns\"]}}";

    Exception failure =
        assertThrows(
            Exception.class,
            () -> JsonUtils.readOrConvertValue(withTypo, DataInsightsSearchConfiguration.class));

    // Asserting the whole sentence, not just the key: Jackson's reference chain already names
    // "tabel", so a key-only assertion passes with the guard deleted.
    assertTrue(
        causeChain(failure).contains("'tabel', which is not a Data Insights asset type"),
        "the failure must say why the key is rejected, got: " + causeChain(failure));
  }

  private static DataInsightsSearchConfiguration.MappingFields readShippedConfig() {
    String json = readResource(DataInsightsSearchInterface.DATA_INSIGHTS_SEARCH_CONFIG_PATH);
    return JsonUtils.readOrConvertValue(json, DataInsightsSearchConfiguration.class)
        .getMappingFields();
  }

  private static String causeChain(Throwable failure) {
    StringBuilder messages = new StringBuilder();
    for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
      messages.append(cause.getMessage()).append(' ');
    }
    return messages.toString();
  }

  private static String readResource(String path) {
    try (InputStream in = DataInsightsSearchConfigurationTest.class.getResourceAsStream(path)) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("could not read " + path, e);
    }
  }
}
