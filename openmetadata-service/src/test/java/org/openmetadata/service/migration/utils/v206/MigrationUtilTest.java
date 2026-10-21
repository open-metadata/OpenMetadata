package org.openmetadata.service.migration.utils.v206;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class MigrationUtilTest {

  // The alert as stored before this release, with one admin setting changed (enabled: false).
  private static final String STORED_ALERT =
      """
      {
        "name": "ActivityFeedAlert",
        "enabled": false,
        "pollInterval": 30,
        "filteringRules": {
          "resources": ["all"],
          "rules": [
            {"name": "matchAnyEventType", "condition": "matchAnyEventType({'entityCreated'}) && !matchAnySource({'user', 'team'})"},
            {"name": "matchAnyFieldChange", "condition": "matchAnyFieldChange({'description', 'owners'})"},
            {"name": "matchAnySource", "condition": "matchAnySource({'table', 'metric'})"},
            {"name": "noBotAllowed", "condition": "isBot()"}
          ]
        },
        "input": {
          "filters": [
            {"name": "filterByFieldChange", "arguments": [{"name": "fieldChangeList", "input": ["description", "owners"]}]},
            {"name": "filterBySource", "arguments": [{"name": "sourceList", "input": ["table"]}]}
          ]
        }
      }
      """;

  @Test
  void addsEntityStatusAndDataContractAndKeepsAdminSettings() {
    ObjectNode alert = (ObjectNode) JsonUtils.readTree(STORED_ALERT);

    assertTrue(MigrationUtil.addMissingValues(alert));

    assertEquals(
        "matchAnyFieldChange({'description', 'owners', 'entityStatus'})", conditionOf(alert, 1));
    assertEquals("matchAnySource({'table', 'metric', 'dataContract'})", conditionOf(alert, 2));
    assertEquals(
        "matchAnyEventType({'entityCreated'}) && !matchAnySource({'user', 'team'})",
        conditionOf(alert, 0));
    assertEquals(
        "[\"description\",\"owners\",\"entityStatus\"]",
        alert.at("/input/filters/0/arguments/0/input").toString());
    assertEquals(
        "[\"table\",\"dataContract\"]", alert.at("/input/filters/1/arguments/0/input").toString());
    assertFalse(alert.get("enabled").asBoolean());
  }

  @Test
  void secondRunChangesNothing() {
    ObjectNode alert = (ObjectNode) JsonUtils.readTree(STORED_ALERT);
    MigrationUtil.addMissingValues(alert);
    String once = alert.toString();

    assertFalse(MigrationUtil.addMissingValues(alert));
    assertEquals(once, alert.toString());
  }

  private static String conditionOf(ObjectNode alert, int rule) {
    return alert.at("/filteringRules/rules/" + rule + "/condition").asText();
  }
}
