package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.BadRequestException;

class TimezoneUtilTest {

  @Test
  void zoneOfAcceptsIanaIds() {
    assertEquals(ZoneId.of("Europe/Tallinn"), TimezoneUtil.zoneOf("Europe/Tallinn").orElseThrow());
    assertEquals(ZoneId.of("UTC"), TimezoneUtil.zoneOf(" UTC ").orElseThrow());
  }

  @Test
  void zoneOfIsEmptyWhenUnset() {
    assertTrue(TimezoneUtil.zoneOf(null).isEmpty());
    assertTrue(TimezoneUtil.zoneOf("  ").isEmpty());
  }

  @Test
  void normalizeTrimsIdsAndClearsBlanks() {
    assertEquals("Europe/Tallinn", TimezoneUtil.normalize(" Europe/Tallinn "));
    assertEquals("UTC", TimezoneUtil.normalize("UTC"));
    assertNull(TimezoneUtil.normalize(null));
    assertNull(TimezoneUtil.normalize("  "));
    assertThrows(BadRequestException.class, () -> TimezoneUtil.normalize("Mars/Olympus"));
  }

  @Test
  void zoneOfRejectsOffsetsAndUnknownIds() {
    BadRequestException offset =
        assertThrows(BadRequestException.class, () -> TimezoneUtil.zoneOf("+02:00"));
    assertTrue(offset.getMessage().contains("+02:00"));
    assertThrows(BadRequestException.class, () -> TimezoneUtil.zoneOf("Mars/Olympus"));
    assertThrows(BadRequestException.class, () -> TimezoneUtil.zoneOf("europe/tallinn"));
  }
}
