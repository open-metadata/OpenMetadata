package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.fluent.Directories;
import org.openmetadata.sdk.fluent.Spreadsheets;
import org.openmetadata.sdk.fluent.Worksheets;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.SpreadsheetService;

/**
 * Integration tests for Spreadsheet entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds Spreadsheet-specific tests for
 * directory hierarchy, root-filter listing, and worksheet relationships.
 */
@Execution(ExecutionMode.CONCURRENT)
public class SpreadsheetResourceIT extends BaseEntityIT<Spreadsheet, CreateSpreadsheet> {

  {
    supportsFollowers = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsBulkAPI = false;
    supportsDataContract = false;
  }

  @BeforeAll
  static void setup() {
    Spreadsheets.setDefaultClient(SdkClients.adminClient());
    Directories.setDefaultClient(SdkClients.adminClient());
    Worksheets.setDefaultClient(SdkClients.adminClient());
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateSpreadsheet createMinimalRequest(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    return new CreateSpreadsheet()
        .withName(ns.prefix("spreadsheet"))
        .withService(driveService.getFullyQualifiedName())
        .withDescription("Test spreadsheet created by integration test");
  }

  @Override
  protected CreateSpreadsheet createRequest(String name, TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    return new CreateSpreadsheet().withName(name).withService(driveService.getFullyQualifiedName());
  }

  @Override
  protected Spreadsheet createEntity(CreateSpreadsheet createRequest) {
    return getSpreadsheetService().create(createRequest);
  }

  @Override
  protected Spreadsheet getEntity(String id) {
    return getSpreadsheetService().get(id);
  }

  @Override
  protected Spreadsheet getEntityByName(String fqn) {
    return getSpreadsheetService().getByName(fqn);
  }

  @Override
  protected Spreadsheet patchEntity(String id, Spreadsheet entity) {
    return getSpreadsheetService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getSpreadsheetService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getSpreadsheetService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getSpreadsheetService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "spreadsheet";
  }

  @Override
  protected void validateCreatedEntity(Spreadsheet entity, CreateSpreadsheet createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Spreadsheet must have a service");
    assertEquals(
        createRequest.getService(),
        entity.getService().getFullyQualifiedName(),
        "Service FQN should match");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain spreadsheet name");
  }

  @Override
  protected ListResponse<Spreadsheet> listEntities(ListParams params) {
    return getSpreadsheetService().list(params);
  }

  @Override
  protected Spreadsheet getEntityWithFields(String id, String fields) {
    return getSpreadsheetService().get(id, fields);
  }

  @Override
  protected Spreadsheet getEntityByNameWithFields(String fqn, String fields) {
    return getSpreadsheetService().getByName(fqn, fields);
  }

  @Override
  protected Spreadsheet getEntityIncludeDeleted(String id) {
    return getSpreadsheetService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getSpreadsheetService().getVersionList(id);
  }

  @Override
  protected Spreadsheet getVersion(UUID id, Double version) {
    return getSpreadsheetService().getVersion(id.toString(), version);
  }

  private SpreadsheetService getSpreadsheetService() {
    return new SpreadsheetService(SdkClients.adminClient().getHttpClient());
  }

  // ===================================================================
  // SPREADSHEET-SPECIFIC TESTS
  // ===================================================================

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
  void test_spreadsheetFQNStructure(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    Spreadsheet spreadsheet =
        Spreadsheets.create()
            .name(ns.prefix("fqn_test"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    String expectedFqn = driveService.getFullyQualifiedName() + "." + ns.prefix("fqn_test");
    assertEquals(expectedFqn, spreadsheet.getFullyQualifiedName());
  }

  @Test
  void test_createSpreadsheetNameUniqueness(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    String uniqueName = ns.prefix("unique_spreadsheet");

    Spreadsheets.create()
        .name(uniqueName)
        .withService(driveService.getFullyQualifiedName())
        .execute();

    assertThrows(
        Exception.class,
        () ->
            Spreadsheets.create()
                .name(uniqueName)
                .withService(driveService.getFullyQualifiedName())
                .execute(),
        "Creating duplicate spreadsheet under same service should fail");
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

    for (int i = 0; i < 2; i++) {
      Spreadsheets.create()
          .name(ns.prefix("report_" + i))
          .withService(driveService.getFullyQualifiedName())
          .withParent(dir1.getEntityReference())
          .execute();
    }

    ListParams params = new ListParams().withDirectory(dir1.getFullyQualifiedName());
    ListResponse<Spreadsheet> list = SdkClients.adminClient().spreadsheets().list(params);
    assertTrue(list.getData().size() >= 2);
    assertTrue(
        list.getData().stream()
            .allMatch(
                s -> s.getDirectory() != null && s.getDirectory().getId().equals(dir1.getId())));
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
        .name(ns.prefix("childSpreadsheet1"))
        .withService(driveService.getFullyQualifiedName())
        .withParent(sheetsDir.getEntityReference())
        .execute();

    ListParams params =
        new ListParams().withService(driveService.getFullyQualifiedName()).withRoot("true");
    ListResponse<Spreadsheet> rootSpreadsheets =
        SdkClients.adminClient().spreadsheets().list(params);

    for (Spreadsheet spreadsheet : rootSpreadsheets.getData()) {
      assertNull(spreadsheet.getDirectory(), "Root spreadsheet should not have directory");
    }
  }
}
