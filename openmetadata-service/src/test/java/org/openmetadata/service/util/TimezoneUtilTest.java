package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
  void zoneOfRejectsOffsetsAndUnknownIds() {
    BadRequestException offset =
        assertThrows(BadRequestException.class, () -> TimezoneUtil.validate("+02:00"));
    assertTrue(offset.getMessage().contains("+02:00"));
    assertThrows(BadRequestException.class, () -> TimezoneUtil.validate("Mars/Olympus"));
    assertThrows(BadRequestException.class, () -> TimezoneUtil.validate("europe/tallinn"));
  }
}
