package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnOccurrence;
import org.openmetadata.schema.api.data.GroupedColumnsResponse;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.csv.CsvAsyncJobManager;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.security.Authorizer;

/**
 * The CSV import must cost one catalog walk per request no matter how many rows the file has, and
 * must refuse oversized files and oversized synchronous write jobs before doing any work. These
 * are the bounds that keep a few-KB request from holding a request thread (and, 64 at a time, the
 * whole REST API) for minutes.
 */
class ColumnRepositoryImportTest {

  private ColumnRepository repository;

  @BeforeEach
  void setUp() {
    repository = spy(new ColumnRepository(mock(Authorizer.class), mock(ElasticSearchClient.class)));
    doReturn(catalog())
        .when(repository)
        .searchColumns(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void dryRunResolvesEveryRowAgainstOneCatalogWalk() {
    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\n"
                + "col_a,A,desc,,\n"
                + "nope,B,desc,,\n"
                + "col_b,C,desc,,\n"
                + ",D,desc,,",
            true,
            null,
            null,
            null,
            null,
            null);

    verify(repository, times(1)).searchColumns(any(), isNull(), any(), any(), any(), any(), any());
    assertEquals(4, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(2, result.getNumberOfRowsFailed());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
  }

  @Test
  void writeImportAppliesExplicitUpdatesFromTheSingleWalk() {
    BulkOperationResult writeResult =
        new BulkOperationResult()
            .withStatus(ApiStatus.SUCCESS)
            .withNumberOfRowsProcessed(1)
            .withNumberOfRowsPassed(1);
    ArgumentCaptor<BulkColumnUpdateRequest> requests =
        ArgumentCaptor.forClass(BulkColumnUpdateRequest.class);
    doReturn(writeResult).when(repository).bulkUpdateColumns(any(), any(), requests.capture());

    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\n"
                + "col_a,A,desc,,\n"
                + "col_b,B,desc,,",
            false,
            null,
            null,
            null,
            null,
            null);

    verify(repository, times(1)).searchColumns(any(), isNull(), any(), any(), any(), any(), any());
    verify(repository, times(2))
        .bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));
    assertEquals(2, result.getNumberOfRowsPassed());

    // Explicit columnUpdates mode, not the search-based mode, with the occurrence FQN from the
    // walk.
    for (BulkColumnUpdateRequest request : requests.getAllValues()) {
      assertNull(request.getColumnName());
      assertEquals(1, request.getColumnUpdates().size());
    }
    assertEquals(
        "svc.db.schema.t1.col_a",
        requests.getAllValues().get(0).getColumnUpdates().get(0).getColumnFQN());
    assertEquals(
        "svc.db.schema.t1.col_b",
        requests.getAllValues().get(1).getColumnUpdates().get(0).getColumnFQN());
  }

  @Test
  void identicalWriteRowsShareOneUpdatePass() {
    BulkOperationResult writeResult =
        new BulkOperationResult()
            .withStatus(ApiStatus.SUCCESS)
            .withNumberOfRowsProcessed(1)
            .withNumberOfRowsPassed(1);
    doReturn(writeResult)
        .when(repository)
        .bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));

    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\n"
                + "col_a,A,desc,,\n"
                + "col_a,A,desc,,\n"
                + "col_a,A,desc,,",
            false,
            null,
            null,
            null,
            null,
            null);

    // Three rows, one distinct payload: the rewrite runs once, every row still counts.
    verify(repository, times(1))
        .bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));
    assertEquals(3, result.getNumberOfRowsPassed());
  }

  @Test
  void importRejectsMoreRowsThanTheCapBeforeWalkingTheCatalog() {
    StringBuilder csv = new StringBuilder("column\n");
    for (int i = 0; i <= CsvAsyncJobManager.MAX_IMPORT_CSV_ROWS; i++) {
      csv.append("col_").append(i).append('\n');
    }

    assertThrows(
        BadRequestException.class,
        () ->
            repository.importColumnsCSV(
                null, null, csv.toString(), true, null, null, null, null, null));
    verify(repository, never()).searchColumns(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void syncWriteImportRejectsMoreUpdatesThanTheCapBeforeWriting() {
    List<ColumnOccurrence> occurrences = new ArrayList<>();
    for (int i = 0; i <= ColumnRepository.MAX_SYNC_IMPORT_COLUMN_UPDATES; i++) {
      occurrences.add(occurrence("svc.db.schema.t" + i + ".col_a", "table"));
    }
    doReturn(List.of(group("col_a", occurrences)))
        .when(repository)
        .searchColumns(any(), isNull(), any(), any(), any(), any(), any());

    assertThrows(
        IllegalArgumentException.class,
        () ->
            repository.importColumnsCSV(
                null,
                null,
                "column,displayName,description,tags,glossaryTerms\ncol_a,A,desc,,",
                false,
                null,
                null,
                null,
                null,
                null));
    verify(repository, never()).bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));
  }

  @Test
  void importWithoutDataRowsIsAborted() {
    CsvImportResult result =
        repository.importColumnsCSV(
            null, null, "column,displayName,description\n", true, null, null, null, null, null);

    assertEquals(ApiStatus.ABORTED, result.getStatus());
    assertEquals("No data to import", result.getAbortReason());
  }

  @Test
  void blankLinesAreSkippedAndShortRowsStillResolve() {
    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\n"
                + "\n"
                + "col_a\n"
                + "col_a,Display only\n",
            true,
            null,
            null,
            null,
            null,
            null);

    // The blank line does not count; one-column and two-column rows resolve the same name.
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
  }

  @Test
  void writeRowWhoseUpdatePassesNothingIsFailed() {
    BulkOperationResult writeResult =
        new BulkOperationResult()
            .withStatus(ApiStatus.FAILURE)
            .withNumberOfRowsProcessed(1)
            .withNumberOfRowsPassed(0)
            .withNumberOfRowsFailed(1);
    doReturn(writeResult)
        .when(repository)
        .bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));

    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\ncol_a,A,desc,,",
            false,
            null,
            null,
            null,
            null,
            null);

    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertEquals(ApiStatus.FAILURE, result.getStatus());
  }

  @Test
  void writeRowSurvivesAnUpdatePassThatThrows() {
    doReturn(
            new BulkOperationResult()
                .withStatus(ApiStatus.SUCCESS)
                .withNumberOfRowsProcessed(1)
                .withNumberOfRowsPassed(1))
        .doThrow(new RuntimeException("database is gone"))
        .when(repository)
        .bulkUpdateColumns(any(), any(), any(BulkColumnUpdateRequest.class));

    CsvImportResult result =
        repository.importColumnsCSV(
            null,
            null,
            "column,displayName,description,tags,glossaryTerms\n"
                + "col_a,A,desc,,\n"
                + "col_b,B,desc,,",
            false,
            null,
            null,
            null,
            null,
            null);

    // One row applied, one row failed on the throwing pass; the import still answers.
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
  }

  @Test
  void searchBasedBulkUpdateDryRunSharesTheOccurrenceConversion() {
    BulkOperationResult result =
        repository.bulkUpdateColumns(
            null,
            null,
            new BulkColumnUpdateRequest()
                .withColumnName("col_a")
                .withDryRun(true)
                .withDescription("d"));

    // The stubbed walk returns one occurrence per catalog group; dry-run reports both as
    // would-update rows without touching a repository.
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(0, result.getNumberOfRowsFailed());
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
  }

  private static List<GroupedColumnsResponse> catalog() {
    return List.of(
        group("col_a", occurrence("svc.db.schema.t1.col_a", "table")),
        group("col_b", occurrence("svc.db.schema.t1.col_b", "table")));
  }

  private static GroupedColumnsResponse group(String name, List<ColumnOccurrence> occurrences) {
    GroupedColumnsResponse group = new GroupedColumnsResponse();
    group.setColumnName(name);
    group.setOccurrences(occurrences);
    group.setTotalCount(occurrences.size());
    return group;
  }

  private static GroupedColumnsResponse group(String name, ColumnOccurrence... occurrences) {
    return group(name, List.of(occurrences));
  }

  private static ColumnOccurrence occurrence(String columnFQN, String entityType) {
    ColumnOccurrence occurrence = new ColumnOccurrence();
    occurrence.setColumnFQN(columnFQN);
    occurrence.setEntityType(entityType);
    return occurrence;
  }
}
