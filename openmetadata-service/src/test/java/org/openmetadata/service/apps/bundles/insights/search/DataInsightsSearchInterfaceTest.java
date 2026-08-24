package org.openmetadata.service.apps.bundles.insights.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * {@code getEntityAttributeFields} decides which entity attributes reach a type's Data Insights
 * documents. Both failure modes it has carried are silent ones: a type the config forgot would have
 * produced documents holding only the common attributes, and returning the shared {@code common}
 * list let each call append to the list the next call starts from.
 */
class DataInsightsSearchInterfaceTest {

  private static final DataInsightsSearchInterface SEARCH_INTERFACE =
      mock(DataInsightsSearchInterface.class, CALLS_REAL_METHODS);

  @Test
  void aTypeTheConfigForgotFailsAndNamesIt() {
    DataInsightsSearchConfiguration config =
        configFor("{\"common\": [\"id\"], \"table\": [\"columns\"]}");

    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> SEARCH_INTERFACE.getEntityAttributeFields(config, "topic"));

    assertTrue(failure.getMessage().contains("topic"), failure.getMessage());
    assertTrue(
        failure.getMessage().contains(DataInsightsSearchInterface.DATA_INSIGHTS_SEARCH_CONFIG_PATH),
        failure.getMessage());
  }

  @Test
  void oneTypesAttributesDoNotLeakIntoTheNext() {
    // The workflow reuses one parsed configuration for every type in its loop, so appending to the
    // shared common list would have each type inherit the attributes of the types before it.
    DataInsightsSearchConfiguration config =
        configFor("{\"common\": [\"id\"], \"table\": [\"columns\"], \"topic\": [\"service\"]}");

    assertEquals(
        List.of("id", "columns"), SEARCH_INTERFACE.getEntityAttributeFields(config, "table"));

    List<String> topicFields = SEARCH_INTERFACE.getEntityAttributeFields(config, "topic");
    assertEquals(List.of("id", "service"), topicFields);
    assertFalse(topicFields.contains("columns"), "table's attributes leaked into topic");
  }

  private static DataInsightsSearchConfiguration configFor(String mappingFields) {
    return JsonUtils.readOrConvertValue(
        String.format("{\"mappingFields\": %s}", mappingFields),
        DataInsightsSearchConfiguration.class);
  }
}
