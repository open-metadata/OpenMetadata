package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MigrationTestRunnerTest {

  @Test
  void testVersionToPackageStandard() {
    assertEquals("v1120", MigrationTestRunner.versionToPackage("1.12.0"));
  }

  @Test
  void testVersionToPackageSingleDigit() {
    assertEquals("v110", MigrationTestRunner.versionToPackage("1.1.0"));
  }

  @Test
  void testVersionToPackageWithPatch() {
    assertEquals("v1115", MigrationTestRunner.versionToPackage("1.1.15"));
  }

  @Test
  void testVersionToPackageWithExtension() {
    assertEquals("v1120", MigrationTestRunner.versionToPackage("1.12.0-collate"));
  }

  @Test
  void testVersionToPackageMajorOnly() {
    assertEquals("v200", MigrationTestRunner.versionToPackage("2.0.0"));
  }

  @Test
  void testVersionToPackageTwoParts() {
    assertEquals("v10", MigrationTestRunner.versionToPackage("1.0"));
  }

  @Test
  void testVersionToPackageSinglePart() {
    assertEquals("v3", MigrationTestRunner.versionToPackage("3"));
  }

  @Test
  void testVersionToPackageWithExtensionTwoParts() {
    assertEquals("v16", MigrationTestRunner.versionToPackage("1.6-SNAPSHOT"));
  }
}
