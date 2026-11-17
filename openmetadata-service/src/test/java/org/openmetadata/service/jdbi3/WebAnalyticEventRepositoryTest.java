package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class WebAnalyticEventRepositoryTest {

  // Stored rows carry these hashes. A change here leaves every existing event row unmatched.
  private static final String PAGE_VIEW_HASH = "36c3c341bdf7ed4b36652d62d5cb14d7";
  private static final String CUSTOM_EVENT_HASH = "c8b0247e97b3b6334312cddb4de4182e";

  @Test
  void eventTypeHashMatchesTheStoredKey() {
    assertEquals(PAGE_VIEW_HASH, WebAnalyticEventRepository.eventTypeHash("PageView"));
  }

  @Test
  void eventTypeHashesCoverEveryEventType() {
    assertEquals(
        List.of(PAGE_VIEW_HASH, CUSTOM_EVENT_HASH), WebAnalyticEventRepository.eventTypeHashes());
  }
}
