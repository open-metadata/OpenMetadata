/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Server-side sorting for {@code GET /v1/services/ingestionPipelines} (collate#3919).
 *
 * <p>The UI's Name column renders {@code displayName ?? name}, so the list has to be orderable by
 * that same value. Pipelines created from the UI get a machine-generated {@code name} that bears no
 * relation to the label the user typed — Automations use {@code
 * OpenMetadata_application_<random>} — so ordering by the raw {@code name} column is arbitrary on
 * screen. Every fixture below is therefore seeded so that ascending {@code name} order is the exact
 * reverse of ascending {@code displayName} order.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IngestionPipelineSortIT {

  private static final Date START_DATE = Date.from(Instant.parse("2022-06-10T15:06:47Z"));

  private IngestionPipeline createPipeline(
      DatabaseService service, String name, String displayName) {
    return SdkClients.adminClient()
        .ingestionPipelines()
        .create(
            new CreateIngestionPipeline()
                .withName(name)
                .withDisplayName(displayName)
                .withPipelineType(PipelineType.METADATA)
                .withService(service.getEntityReference())
                .withSourceConfig(
                    new SourceConfig()
                        .withConfig(new DatabaseServiceMetadataPipeline().withIncludeViews(true)))
                .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE)));
  }

  private ListParams sortParams(DatabaseService service, String sortOrder, int limit) {
    return new ListParams()
        .setService(service.getName())
        .setLimit(limit)
        .addQueryParam("sortField", "displayName")
        .addQueryParam("sortOrder", sortOrder);
  }

  private ListResponse<IngestionPipeline> listSorted(
      DatabaseService service, String sortOrder, int limit) {
    OpenMetadataClient client = SdkClients.adminClient();

    return client.ingestionPipelines().list(sortParams(service, sortOrder, limit));
  }

  private List<String> displayNamesOf(ListResponse<IngestionPipeline> response) {
    return response.getData().stream().map(IngestionPipeline::getDisplayName).toList();
  }

  private List<String> listDisplayNames(DatabaseService service, String sortOrder) {
    return displayNamesOf(listSorted(service, sortOrder, 50));
  }

  @Test
  void test_listSortedByDisplayName_ascending(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    // name ascending is a-then-z; displayName ascending is the reverse.
    createPipeline(service, ns.prefix("pipeline-a"), "zzz-" + ns.prefix("last"));
    createPipeline(service, ns.prefix("pipeline-z"), "aaa-" + ns.prefix("first"));

    assertEquals(
        List.of("aaa-" + ns.prefix("first"), "zzz-" + ns.prefix("last")),
        listDisplayNames(service, "asc"));
  }

  @Test
  void test_listSortedByDisplayName_descending(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    createPipeline(service, ns.prefix("pipeline-a"), "aaa-" + ns.prefix("first"));
    createPipeline(service, ns.prefix("pipeline-z"), "zzz-" + ns.prefix("last"));

    assertEquals(
        List.of("zzz-" + ns.prefix("last"), "aaa-" + ns.prefix("first")),
        listDisplayNames(service, "desc"));
  }

  /** The sort key is COALESCE(NULLIF(displayName,''), name) — it must match getEntityName. */
  @Test
  void test_listSortedByDisplayName_fallsBackToNameWhenDisplayNameAbsent(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    createPipeline(service, ns.prefix("zzz-no-display-name"), null);
    createPipeline(service, ns.prefix("mmm-pipeline"), "aaa-" + ns.prefix("has-display-name"));

    List<IngestionPipeline> sorted = listSorted(service, "asc", 50).getData();

    // The pipeline without a displayName orders by its name, after "aaa-...".
    assertEquals(2, sorted.size());
    assertEquals("aaa-" + ns.prefix("has-display-name"), sorted.get(0).getDisplayName());
    assertNull(sorted.get(1).getDisplayName());
    assertEquals(ns.prefix("zzz-no-display-name"), sorted.get(1).getName());
  }

  /** The cursor is the (displayNameSort, id) tuple, so paging must not duplicate or skip rows. */
  @Test
  void test_listSortedByDisplayName_pagesWithoutGapsOrDuplicates(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    // Creation order is deliberately unrelated to both name and displayName order.
    createPipeline(service, ns.prefix("pipeline-c"), "bbb-" + ns.prefix("second"));
    createPipeline(service, ns.prefix("pipeline-a"), "ccc-" + ns.prefix("third"));
    createPipeline(service, ns.prefix("pipeline-b"), "aaa-" + ns.prefix("first"));

    List<String> expected =
        List.of(
            "aaa-" + ns.prefix("first"), "bbb-" + ns.prefix("second"), "ccc-" + ns.prefix("third"));

    ListResponse<IngestionPipeline> firstPage = listSorted(service, "asc", 2);
    assertEquals(expected.subList(0, 2), displayNamesOf(firstPage));
    assertNotNull(firstPage.getPaging().getAfter());

    ListResponse<IngestionPipeline> secondPage =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(sortParams(service, "asc", 2).setAfter(firstPage.getPaging().getAfter()));
    assertEquals(expected.subList(2, 3), displayNamesOf(secondPage));

    // Walking back from the second page must land on the first page again.
    ListResponse<IngestionPipeline> backToFirst =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(sortParams(service, "asc", 2).setBefore(secondPage.getPaging().getBefore()));
    assertEquals(expected.subList(0, 2), displayNamesOf(backToFirst));
  }

  /** Without sortField the endpoint must behave exactly as before — ordered by name. */
  @Test
  void test_listWithoutSortField_isUnchangedAndOrdersByName(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    createPipeline(service, ns.prefix("pipeline-a"), "zzz-" + ns.prefix("last"));
    createPipeline(service, ns.prefix("pipeline-z"), "aaa-" + ns.prefix("first"));

    ListResponse<IngestionPipeline> response =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(new ListParams().setService(service.getName()).setLimit(50));

    assertEquals(
        List.of(ns.prefix("pipeline-a"), ns.prefix("pipeline-z")),
        response.getData().stream().map(IngestionPipeline::getName).toList());
  }

  @Test
  void test_listWithUnsupportedSortField_isRejected(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    createPipeline(service, ns.prefix("pipeline-a"), "aaa-" + ns.prefix("first"));

    ListParams params =
        new ListParams()
            .setService(service.getName())
            .addQueryParam("sortField", "sourceConfig")
            .addQueryParam("sortOrder", "asc");

    assertThrows(
        OpenMetadataException.class,
        () -> SdkClients.adminClient().ingestionPipelines().list(params));
  }

  /**
   * An unsupported sortOrder must be rejected rather than silently treated as ascending — a typo
   * that quietly returns the opposite page is indistinguishable from a server bug on the client.
   */
  @Test
  void test_listWithUnsupportedSortOrder_isRejected(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    createPipeline(service, ns.prefix("pipeline-a"), "aaa-" + ns.prefix("first"));

    ListParams params = sortParams(service, "descending", 50);

    assertThrows(
        OpenMetadataException.class,
        () -> SdkClients.adminClient().ingestionPipelines().list(params));
  }

  /**
   * {@code serviceType} is the parent service category, which lives in {@code
   * entity_relationship.fromEntity} rather than on the pipeline row — it is a join, not a plain
   * condition, so the ordered query has to build it the same way the unordered one does. Without
   * that the sorted list silently spans every service category while {@code paging.total} stays
   * filtered. The UI always sends this parameter.
   */
  @Test
  void test_listSortedByDisplayName_honoursServiceTypeFilter(TestNamespace ns) {
    DatabaseService databaseService = DatabaseServiceTestFactory.createPostgres(ns);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    createPipeline(databaseService, ns.prefix("pipeline-z"), "aaa-" + ns.prefix("db-first"));
    createPipeline(databaseService, ns.prefix("pipeline-a"), "zzz-" + ns.prefix("db-last"));
    createDashboardPipeline(dashboardService, ns.prefix("pipeline-m"), ns.prefix("dashboard-one"));

    ListResponse<IngestionPipeline> matching =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(sortParams(databaseService, "asc", 50).setServiceType("databaseService"));

    assertEquals(
        List.of("aaa-" + ns.prefix("db-first"), "zzz-" + ns.prefix("db-last")),
        displayNamesOf(matching));
    assertEquals(2, matching.getPaging().getTotal());

    // The dashboard service's own pipeline must not leak in under a databaseService filter: the
    // service name alone matches it, so only an honoured serviceType keeps this empty.
    ListResponse<IngestionPipeline> contradictory =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(
                new ListParams()
                    .setService(dashboardService.getName())
                    .setServiceType("databaseService")
                    .setLimit(50)
                    .addQueryParam("sortField", "displayName")
                    .addQueryParam("sortOrder", "asc"));

    assertEquals(List.of(), displayNamesOf(contradictory));
  }

  /**
   * {@code displayName} has no maxLength in the schema, so the sort column truncates rather than
   * rejects. The cursor Java derives has to truncate identically or paging skips a row at the
   * boundary.
   */
  @Test
  void test_listSortedByDisplayName_handlesDisplayNameLongerThanSortColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    String longPrefix = "zzz-" + "x".repeat(300);
    createPipeline(service, ns.prefix("pipeline-a"), longPrefix + ns.prefix("-long"));
    createPipeline(service, ns.prefix("pipeline-b"), "aaa-" + ns.prefix("short"));

    ListResponse<IngestionPipeline> firstPage = listSorted(service, "asc", 1);
    assertEquals(List.of("aaa-" + ns.prefix("short")), displayNamesOf(firstPage));
    assertNotNull(firstPage.getPaging().getAfter());

    ListResponse<IngestionPipeline> secondPage =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(sortParams(service, "asc", 1).setAfter(firstPage.getPaging().getAfter()));

    assertEquals(1, secondPage.getData().size());
    assertEquals(longPrefix + ns.prefix("-long"), secondPage.getData().get(0).getDisplayName());
  }

  /**
   * A page can come back empty when the caller holds a valid cursor but every row past it was
   * deleted meanwhile. Returning a null before-cursor would read as "first page" and dead-end
   * backward navigation, so the caller's own cursor is echoed instead.
   */
  @Test
  void test_listSortedByDisplayName_echoesCursorWhenPageIsEmpty(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    createPipeline(service, ns.prefix("pipeline-a"), "aaa-" + ns.prefix("first"));
    IngestionPipeline second =
        createPipeline(service, ns.prefix("pipeline-b"), "bbb-" + ns.prefix("second"));

    ListResponse<IngestionPipeline> firstPage = listSorted(service, "asc", 1);
    String after = firstPage.getPaging().getAfter();
    assertNotNull(after);

    SdkClients.adminClient()
        .ingestionPipelines()
        .delete(second.getId().toString(), Map.of("hardDelete", "true", "recursive", "false"));

    ListResponse<IngestionPipeline> emptyPage =
        SdkClients.adminClient()
            .ingestionPipelines()
            .list(sortParams(service, "asc", 1).setAfter(after));

    assertEquals(List.of(), displayNamesOf(emptyPage));
    assertEquals(after, emptyPage.getPaging().getBefore());
  }

  private IngestionPipeline createDashboardPipeline(
      DashboardService service, String name, String displayName) {
    return SdkClients.adminClient()
        .ingestionPipelines()
        .create(
            new CreateIngestionPipeline()
                .withName(name)
                .withDisplayName(displayName)
                .withPipelineType(PipelineType.METADATA)
                .withService(service.getEntityReference())
                .withSourceConfig(
                    new SourceConfig().withConfig(new DashboardServiceMetadataPipeline()))
                .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE)));
  }
}
