package org.openmetadata.service.alerting.content.preview;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EntityFixtureLoaderTest {
  private static final int UNKNOWN_RESOURCES = 1000;

  // A preview names its resource, so a name without a fixture must cost nothing that stays.
  @Test
  void onlyFixturesThatExistAreKept() {
    EntityFixtureLoader fixtures = new EntityFixtureLoader();
    fixtures.loadBaseFixture("table");

    for (int resource = 0; resource < UNKNOWN_RESOURCES; resource++) {
      fixtures.loadBaseFixture("unknown" + resource);
      fixtures.loadScenarioFixture("unknown" + resource, "entityUpdated");
    }

    assertEquals(1, fixtures.cachedFiles());
    assertEquals("generic_entity", fixtures.loadBaseFixture("unknown").get("name"));
    assertTrue(fixtures.loadScenarioFixture("unknown", "entityUpdated").isEmpty());
  }
}
