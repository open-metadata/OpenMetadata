package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.sdk.fluent.Spreadsheets;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SpreadsheetResourceIT {

  @BeforeAll
  static void setup() {
    Spreadsheets.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_createSpreadsheet(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet"))
            .withDescription("Test spreadsheet")
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(spreadsheet);
    assertNotNull(spreadsheet.getId());
    assertEquals(ns.prefix("spreadsheet"), spreadsheet.getName());
    assertEquals("Test spreadsheet", spreadsheet.getDescription());
    assertNotNull(spreadsheet.getService());
    assertEquals(
        driveService.getFullyQualifiedName(), spreadsheet.getService().getFullyQualifiedName());
  }

  @Test
  void test_getSpreadsheetById(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_get"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched = Spreadsheets.get(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(
        created.getFullyQualifiedName(),
        fetched.getFullyQualifiedName(),
        "FQN should match between created and fetched");
  }

  @Test
  void test_getSpreadsheetByName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_getByName"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched = Spreadsheets.getByName(created.getFullyQualifiedName());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_deleteSpreadsheet(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_delete"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(created.getId());

    Spreadsheets.delete(created.getId().toString());

    assertThrows(
        Exception.class,
        () -> Spreadsheets.get(created.getId().toString()),
        "Getting deleted spreadsheet should fail");
  }

  @Test
  void test_createSpreadsheetWithOptionalFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_optional"))
            .withDisplayName("Display Name for Spreadsheet")
            .withDescription("Spreadsheet with optional fields")
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(spreadsheet);
    assertEquals("Display Name for Spreadsheet", spreadsheet.getDisplayName());
    assertEquals("Spreadsheet with optional fields", spreadsheet.getDescription());
  }

  @Test
  void test_createSpreadsheetMinimal(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("minimal_spreadsheet"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(spreadsheet);
    assertNotNull(spreadsheet.getId());
    assertEquals(ns.prefix("minimal_spreadsheet"), spreadsheet.getName());
  }

  @Test
  void test_createSpreadsheetWithoutService_fails(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () -> Spreadsheets.create().name(ns.prefix("no_service_spreadsheet")).execute(),
        "Creating spreadsheet without service should fail");
  }

  @Test
  void test_createSpreadsheetWithInvalidService_fails(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () ->
            Spreadsheets.create()
                .name(ns.prefix("invalid_service_spreadsheet"))
                .withService("non_existent_service")
                .execute(),
        "Creating spreadsheet with invalid service should fail");
  }

  @Test
  void test_finderWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_fields"))
            .withDescription("Test spreadsheet for fields")
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched =
        Spreadsheets.find(created.getId().toString()).withFields("service", "owners").fetch();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertNotNull(fetched.getService());
  }

  @Test
  void test_finderByNameWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_name_fields"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched =
        Spreadsheets.findByName(created.getFullyQualifiedName())
            .withFields("service", "tags")
            .fetch();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_createMultipleSpreadsheetsUnderSameService(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    for (int i = 0; i < 3; i++) {
      Spreadsheet spreadsheet =
          Spreadsheets.create()
              .name(ns.prefix("spreadsheet_" + i))
              .withService(driveService.getFullyQualifiedName())
              .execute();

      assertNotNull(spreadsheet);
      assertNotNull(spreadsheet.getId());
      assertTrue(
          spreadsheet.getFullyQualifiedName().contains(ns.prefix("spreadsheet_" + i)),
          "FQN should contain spreadsheet name");
    }
  }

  @Test
  void test_getByNameWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("spreadsheet_byname_fields"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched = Spreadsheets.getByName(created.getFullyQualifiedName(), "service,owners");

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertNotNull(fetched.getService());
  }

  @Test
  void test_spreadsheetFQNStructure(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("fqn_test"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    String expectedFqn = driveService.getFullyQualifiedName() + "." + ns.prefix("fqn_test");
    assertEquals(expectedFqn, spreadsheet.getFullyQualifiedName());
    assertTrue(
        spreadsheet.getFullyQualifiedName().startsWith(driveService.getFullyQualifiedName()),
        "Spreadsheet FQN should start with service FQN");
    assertTrue(
        spreadsheet.getFullyQualifiedName().endsWith(spreadsheet.getName()),
        "Spreadsheet FQN should end with spreadsheet name");
  }

  @Test
  void test_createSpreadsheetNameUniqueness(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    String uniqueName = ns.prefix("unique_spreadsheet");

    Spreadsheet first =
        Spreadsheets.create()
            .name(uniqueName)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(first);

    assertThrows(
        Exception.class,
        () ->
            Spreadsheets.create()
                .name(uniqueName)
                .withService(driveService.getFullyQualifiedName())
                .execute(),
        "Creating duplicate spreadsheet with same name under same service should fail");
  }
}
