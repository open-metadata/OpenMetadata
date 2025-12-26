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
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.fluent.Directories;
import org.openmetadata.sdk.fluent.Spreadsheets;
import org.openmetadata.sdk.fluent.Worksheets;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SpreadsheetResourceIT {

  @BeforeAll
  static void setup() {
    Spreadsheets.setDefaultClient(SdkClients.adminClient());
    Directories.setDefaultClient(SdkClients.adminClient());
    Worksheets.setDefaultClient(SdkClients.adminClient());
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

  @Test
  void test_spreadsheetDirectlyUnderService(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("directSpreadsheet"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNull(spreadsheet.getDirectory());
    assertEquals(
        driveService.getFullyQualifiedName() + "." + ns.prefix("directSpreadsheet"),
        spreadsheet.getFullyQualifiedName());
  }

  @Test
  void test_spreadsheetInDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Directory directory =
        Directories.create()
            .name(ns.prefix("financials"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/path/to/financials")
            .execute();

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("budget2024"))
            .withService(driveService.getFullyQualifiedName())
            .withParent(directory.getEntityReference())
            .execute();

    assertNotNull(spreadsheet.getDirectory());
    assertEquals(directory.getId(), spreadsheet.getDirectory().getId());
    assertEquals(
        directory.getFullyQualifiedName(), spreadsheet.getDirectory().getFullyQualifiedName());
  }

  @Test
  void test_updateSpreadsheet(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.prefix("updateSpreadsheet"))
            .withDescription("description")
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched = Spreadsheets.get(created.getId().toString());
    fetched.setDescription("updated description");

    Spreadsheet updated = Spreadsheets.update(created.getId().toString()).entity(fetched).execute();
    assertEquals("updated description", updated.getDescription());

    fetched = Spreadsheets.get(created.getId().toString());
    fetched.setPath("/new/path/to/spreadsheet");

    updated = Spreadsheets.update(created.getId().toString()).entity(fetched).execute();
    assertEquals("/new/path/to/spreadsheet", updated.getPath());

    fetched = Spreadsheets.get(created.getId().toString());
    fetched.setSize(1024000);

    updated = Spreadsheets.update(created.getId().toString()).entity(fetched).execute();
    assertEquals(Integer.valueOf(1024000), updated.getSize());
  }

  @Test
  void test_patchSpreadsheetAttributes(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("patchSpreadsheet"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Spreadsheet fetched = Spreadsheets.get(spreadsheet.getId().toString());
    fetched.setDescription("patched description");
    Spreadsheet patched =
        Spreadsheets.update(spreadsheet.getId().toString()).entity(fetched).execute();
    assertEquals("patched description", patched.getDescription());
  }

  @org.junit.jupiter.api.Disabled(
      "Worksheet relationship not returned in spreadsheet fields - backend setFields needs worksheets support")
  @Test
  void test_spreadsheetWithWorksheets(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("salesData"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    for (int i = 1; i <= 3; i++) {
      Worksheets.create()
          .name(ns.prefix("sheet" + i))
          .withSpreadsheet(spreadsheet.getFullyQualifiedName())
          .execute();
    }

    Spreadsheet spreadsheetWithWorksheets =
        Spreadsheets.find(spreadsheet.getId().toString()).withFields("worksheets").fetch();
    assertNotNull(spreadsheetWithWorksheets.getWorksheets());
    // Filter worksheets that belong to this test by namespace prefix
    long testWorksheetCount =
        spreadsheetWithWorksheets.getWorksheets().stream()
            .filter(ws -> ws.getName().startsWith(ns.prefix("sheet")))
            .count();
    assertEquals(3, testWorksheetCount, "Should have 3 worksheets with test namespace prefix");

    for (EntityReference worksheetRef : spreadsheetWithWorksheets.getWorksheets()) {
      assertNotNull(worksheetRef.getId());
      assertNotNull(worksheetRef.getName());
    }
  }

  @Test
  void test_listSpreadsheetsByService(TestNamespace ns) {
    DriveService service1 = DriveServiceTestFactory.createGoogleDrive(ns, "service1");
    DriveService service2 = DriveServiceTestFactory.createGoogleDrive(ns, "service2");

    for (int i = 0; i < 3; i++) {
      Spreadsheets.create()
          .name(ns.prefix("spreadsheet_service1_" + i))
          .withService(service1.getFullyQualifiedName())
          .execute();
      Spreadsheets.create()
          .name(ns.prefix("spreadsheet_service2_" + i))
          .withService(service2.getFullyQualifiedName())
          .execute();
    }

    ListParams params = new ListParams().withService(service1.getFullyQualifiedName());
    ListResponse<Spreadsheet> list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 3);
    assertTrue(
        list.getData().stream().allMatch(s -> s.getService().getId().equals(service1.getId())));

    params = new ListParams().withService(service2.getFullyQualifiedName());
    list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 3);
    assertTrue(
        list.getData().stream().allMatch(s -> s.getService().getId().equals(service2.getId())));
  }

  @Test
  void test_spreadsheetFQNPatterns(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet directSpreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("directSheet"))
            .withService(driveService.getFullyQualifiedName())
            .execute();
    assertEquals(
        driveService.getFullyQualifiedName() + "." + ns.prefix("directSheet"),
        directSpreadsheet.getFullyQualifiedName());
    assertNull(directSpreadsheet.getDirectory());

    Directory dir1 =
        Directories.create()
            .name(ns.prefix("finance"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/finance")
            .execute();

    Directory dir2 =
        Directories.create()
            .name(ns.prefix("2024"))
            .withService(driveService.getFullyQualifiedName())
            .withParent(dir1.getFullyQualifiedName())
            .withPath("/finance/2024")
            .execute();

    Spreadsheet dirSpreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("budget"))
            .withService(driveService.getFullyQualifiedName())
            .withParent(dir2.getEntityReference())
            .execute();
    assertEquals(
        driveService.getFullyQualifiedName()
            + "."
            + ns.prefix("finance")
            + "."
            + ns.prefix("2024")
            + "."
            + ns.prefix("budget"),
        dirSpreadsheet.getFullyQualifiedName());
    assertNotNull(dirSpreadsheet.getDirectory());
    assertEquals(dir2.getId(), dirSpreadsheet.getDirectory().getId());
  }

  @Test
  void test_spreadsheetsWithAndWithoutDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Directory directory =
        Directories.create()
            .name(ns.prefix("reports"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/reports")
            .execute();

    for (int i = 0; i < 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("direct_spreadsheet_" + i))
          .withService(driveService.getFullyQualifiedName())
          .execute();
    }

    for (int i = 0; i < 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("dir_spreadsheet_" + i))
          .withService(driveService.getFullyQualifiedName())
          .withParent(directory.getEntityReference())
          .execute();
    }

    ListParams params = new ListParams().withService(driveService.getFullyQualifiedName());
    ListResponse<Spreadsheet> list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 4);

    long withDirectory = list.getData().stream().filter(s -> s.getDirectory() != null).count();
    long withoutDirectory = list.getData().stream().filter(s -> s.getDirectory() == null).count();
    assertTrue(withDirectory >= 2);
    assertTrue(withoutDirectory >= 2);

    params = new ListParams().withDirectory(directory.getFullyQualifiedName());
    list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 2);
    assertTrue(list.getData().stream().allMatch(s -> s.getDirectory() != null));
  }

  @Test
  void test_listSpreadsheetsByDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Directory dir1 =
        Directories.create()
            .name(ns.prefix("reports"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/reports")
            .execute();

    Directory dir2 =
        Directories.create()
            .name(ns.prefix("analytics"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/analytics")
            .execute();

    for (int i = 0; i < 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("report_" + i))
          .withService(driveService.getFullyQualifiedName())
          .withParent(dir1.getEntityReference())
          .execute();
      Spreadsheets.create()
          .name(ns.prefix("analytics_" + i))
          .withService(driveService.getFullyQualifiedName())
          .withParent(dir2.getEntityReference())
          .execute();
    }

    ListParams params = new ListParams().withDirectory(dir1.getFullyQualifiedName());
    ListResponse<Spreadsheet> list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 2);
    assertTrue(
        list.getData().stream()
            .allMatch(
                s -> s.getDirectory() != null && s.getDirectory().getId().equals(dir1.getId())));

    params = new ListParams().withDirectory(dir2.getFullyQualifiedName());
    list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 2);
    assertTrue(
        list.getData().stream()
            .allMatch(
                s -> s.getDirectory() != null && s.getDirectory().getId().equals(dir2.getId())));
  }

  @Test
  void test_listSpreadsheetsWithRootParameter(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Directory sheetsDir =
        Directories.create()
            .name(ns.prefix("sheetsDir"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/sheets")
            .execute();

    Spreadsheets.create()
        .name(ns.prefix("rootSpreadsheet1"))
        .withService(driveService.getFullyQualifiedName())
        .execute();

    Spreadsheets.create()
        .name(ns.prefix("rootSpreadsheet2"))
        .withService(driveService.getFullyQualifiedName())
        .execute();

    Spreadsheets.create()
        .name(ns.prefix("childSpreadsheet1"))
        .withService(driveService.getFullyQualifiedName())
        .withParent(sheetsDir.getEntityReference())
        .execute();

    Spreadsheets.create()
        .name(ns.prefix("childSpreadsheet2"))
        .withService(driveService.getFullyQualifiedName())
        .withParent(sheetsDir.getEntityReference())
        .execute();

    ListParams params = new ListParams().withService(driveService.getFullyQualifiedName());
    ListResponse<Spreadsheet> allSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(allSpreadsheets.getData().size() >= 4);

    params = new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> rootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(rootSpreadsheets.getData().size() >= 2);

    for (Spreadsheet spreadsheet : rootSpreadsheets.getData()) {
      assertNull(spreadsheet.getDirectory());
      assertTrue(
          spreadsheet.getName().equals(ns.prefix("rootSpreadsheet1"))
              || spreadsheet.getName().equals(ns.prefix("rootSpreadsheet2")));
    }

    params = new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("false");
    ListResponse<Spreadsheet> nonRootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(nonRootSpreadsheets.getData().size() >= 4);
  }

  @Test
  void test_listSpreadsheetsWithRootParameterAndPagination(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Directory folder =
        Directories.create()
            .name(ns.prefix("spreadsheetsFolder"))
            .withService(driveService.getFullyQualifiedName())
            .withPath("/spreadsheets")
            .execute();

    for (int i = 1; i <= 7; i++) {
      Spreadsheets.create()
          .name(ns.prefix("rootSpreadsheet" + i))
          .withService(driveService.getFullyQualifiedName())
          .execute();
    }

    for (int i = 1; i <= 3; i++) {
      Spreadsheets.create()
          .name(ns.prefix("childSpreadsheet" + i))
          .withService(driveService.getFullyQualifiedName())
          .withParent(folder.getEntityReference())
          .execute();
    }

    ListParams params =
        new ListParams()
            .withService(driveService.getFullyQualifiedName())
            .withRoot("true")
            .withLimit(3);

    ListResponse<Spreadsheet> firstPage = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(firstPage.getData().size() <= 3);
    assertNotNull(firstPage.getPaging().getAfter());

    for (Spreadsheet spreadsheet : firstPage.getData()) {
      assertNull(spreadsheet.getDirectory());
    }

    params = params.withAfter(firstPage.getPaging().getAfter());
    ListResponse<Spreadsheet> secondPage = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(secondPage.getData().size() <= 3);

    for (Spreadsheet spreadsheet : secondPage.getData()) {
      assertNull(spreadsheet.getDirectory());
    }

    params = new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> allRootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(allRootSpreadsheets.getData().size() >= 7);
  }

  @Test
  void test_listSpreadsheetsWithRootParameterEmptyResult(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    for (int i = 1; i <= 2; i++) {
      Directory dir =
          Directories.create()
              .name(ns.prefix("folder" + i))
              .withService(driveService.getFullyQualifiedName())
              .withPath("/folder" + i)
              .execute();

      for (int j = 1; j <= 2; j++) {
        Spreadsheets.create()
            .name(ns.prefix(dir.getName() + "_spreadsheet" + j))
            .withService(driveService.getFullyQualifiedName())
            .withParent(dir.getEntityReference())
            .execute();
      }
    }

    ListParams params =
        new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> rootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertEquals(0, rootSpreadsheets.getData().size());

    params = new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("false");
    ListResponse<Spreadsheet> allSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(allSpreadsheets.getData().size() >= 4);
    for (Spreadsheet spreadsheet : allSpreadsheets.getData()) {
      assertNotNull(spreadsheet.getDirectory());
      assertEquals("directory", spreadsheet.getDirectory().getType());
    }
  }

  @org.junit.jupiter.api.Disabled(
      "Root filter not working reliably with parallel tests - needs investigation")
  @Test
  void test_listSpreadsheetsWithRootParameterAcrossMultipleServices(TestNamespace ns) {
    DriveService service1 = DriveServiceTestFactory.createGoogleDrive(ns, "googleSheetsService");
    DriveService service2 = DriveServiceTestFactory.createGoogleDrive(ns, "excelOnlineService");

    Directory googleDir =
        Directories.create()
            .name(ns.prefix("googleSheetsFolder"))
            .withService(service1.getFullyQualifiedName())
            .withPath("/sheets")
            .execute();

    for (int i = 1; i <= 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("googleSheet" + i))
          .withService(service1.getFullyQualifiedName())
          .execute();
    }

    for (int i = 1; i <= 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("googleChildSheet" + i))
          .withService(service1.getFullyQualifiedName())
          .withParent(googleDir.getEntityReference())
          .execute();
    }

    Directory excelDir =
        Directories.create()
            .name(ns.prefix("excelFolder"))
            .withService(service2.getFullyQualifiedName())
            .withPath("/excel")
            .execute();

    for (int i = 1; i <= 4; i++) {
      Spreadsheets.create()
          .name(ns.prefix("excelWorkbook" + i))
          .withService(service2.getFullyQualifiedName())
          .execute();
    }

    Spreadsheets.create()
        .name(ns.prefix("excelChildWorkbook"))
        .withService(service2.getFullyQualifiedName())
        .withParent(excelDir.getEntityReference())
        .execute();

    ListParams params =
        new ListParams().withService(service1.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> googleRootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    // Filter to only our test's spreadsheets
    long googleSheetCount =
        googleRootSpreadsheets.getData().stream()
            .filter(s -> s.getName().startsWith(ns.prefix("googleSheet")))
            .count();
    assertTrue(googleSheetCount >= 2, "Should have at least 2 root googleSheet spreadsheets");
    // Verify root spreadsheets have no directory
    for (Spreadsheet spreadsheet : googleRootSpreadsheets.getData()) {
      if (spreadsheet.getName().startsWith(ns.prefix("googleSheet"))) {
        assertNull(spreadsheet.getDirectory(), "Root spreadsheet should not have directory");
      }
    }

    params = new ListParams().withService(service2.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> excelRootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    // Filter to only our test's spreadsheets
    long excelWorkbookCount =
        excelRootSpreadsheets.getData().stream()
            .filter(s -> s.getName().startsWith(ns.prefix("excelWorkbook")))
            .count();
    assertTrue(excelWorkbookCount >= 4, "Should have at least 4 root excelWorkbook spreadsheets");
    // Verify root spreadsheets have no directory
    for (Spreadsheet spreadsheet : excelRootSpreadsheets.getData()) {
      if (spreadsheet.getName().startsWith(ns.prefix("excelWorkbook"))) {
        assertNull(spreadsheet.getDirectory(), "Root spreadsheet should not have directory");
      }
    }

    params = new ListParams().withService(service1.getFullyQualifiedName()).withRoot("false");
    ListResponse<Spreadsheet> allGoogleSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(allGoogleSpreadsheets.getData().size() >= 4);

    params = new ListParams().withService(service2.getFullyQualifiedName()).withRoot("false");
    ListResponse<Spreadsheet> allExcelSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(allExcelSpreadsheets.getData().size() >= 5);
  }
}
