package org.openmetadata.schema.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class VersionUtilsTest {

  @Test
  void getMajorMinorVersionExtractsMajorMinorFromFullVersion() {
    assertEquals("1.12", VersionUtils.getMajorMinorVersion("1.12.8"));
    assertEquals("1.13", VersionUtils.getMajorMinorVersion("1.13.0"));
    assertEquals("2.0", VersionUtils.getMajorMinorVersion("2.0.0"));
  }

  @Test
  void getMajorMinorVersionIgnoresPatchAndQualifier() {
    assertEquals("1.13", VersionUtils.getMajorMinorVersion("1.13.5-SNAPSHOT"));
    assertEquals("1.13", VersionUtils.getMajorMinorVersion("1.13.0-rc1"));
  }

  @Test
  void getMajorMinorVersionHandlesFourSegmentVersions() {
    assertEquals("1.12", VersionUtils.getMajorMinorVersion("1.12.8.4"));
  }

  @Test
  void getMajorMinorVersionReturnsInputWhenFewerThanTwoSegments() {
    assertEquals("1", VersionUtils.getMajorMinorVersion("1"));
    assertEquals("", VersionUtils.getMajorMinorVersion(""));
  }

  @Test
  void getMajorMinorVersionReturnsNullForNull() {
    assertNull(VersionUtils.getMajorMinorVersion(null));
  }
}
