package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnOccurrence;
import org.openmetadata.schema.api.data.ColumnUpdate;
import org.openmetadata.schema.api.data.GroupedColumnsResponse;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.csv.CsvAsyncJobManager;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The CSV import must cost one catalog walk per request no matter how many rows the file has, and
 * must refuse oversized files and oversized synchronous write jobs before doing any work. These
 * are the bounds that keep a few-KB request from holding a request thread (and, 64 at a time, the
 * whole REST API) for minutes.
 */
class ColumnRepositoryImportTest {

  private static final String HELD_COLUMN = "svc.db.schema.t1.col_c";
  private static final String NEW_COLUMN = "svc.db.schema.t2.col_c";
  private static final GlossaryTerm DEPRECATED =
      new GlossaryTerm()
          .withFullyQualifiedName("Glossary.Revenue")
          .withEntityStatus(EntityStatus.DEPRECATED);

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
    // would-update rows without touching a repository, converted through the same helper the
    // CSV import uses.
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());
    assertEquals(0, result.getNumberOfRowsFailed());
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(
        List.of("svc.db.schema.t1.col_a", "svc.db.schema.t1.col_b"),
        result.getSuccessRequest().stream()
            .map(r -> ((ColumnUpdate) r.getRequest()).getColumnFQN())
            .toList());
    assertEquals(
        "d", ((ColumnUpdate) result.getSuccessRequest().get(0).getRequest()).getDescription());
  }

  /**
   * A dry run applies nothing, so it runs the write's glossary-term check itself: a row passes when
   * one of its columns can take the term, here the column that already holds it.
   */
  @Test
  void csvDryRunFailsARowNoColumnCanTakeAnUnapprovedTermOn() {
    doReturn(termCatalog())
        .when(repository)
        .searchColumns(any(), any(), any(), any(), any(), any(), any());
    try (MockedStatic<Entity> ignored = deprecatedTermHeldOn(HELD_COLUMN)) {
      CsvImportResult result =
          repository.importColumnsCSV(
              null,
              null,
              "column,displayName,description,tags,glossaryTerms\n"
                  + "col_c,,,,%s\n".formatted(DEPRECATED.getFullyQualifiedName())
                  + "col_d,,,,%s".formatted(DEPRECATED.getFullyQualifiedName()),
              true,
              null,
              null,
              null,
              null,
              null);

      assertEquals(1, result.getNumberOfRowsPassed());
      assertEquals(1, result.getNumberOfRowsFailed());
    }
  }

  @Test
  void searchDryRunReportsTheColumnsAnUnapprovedTermWouldBeRejectedOn() {
    doReturn(termCatalog().subList(0, 1))
        .when(repository)
        .searchColumns(any(), any(), any(), any(), any(), any(), any());
    try (MockedStatic<Entity> ignored = deprecatedTermHeldOn(HELD_COLUMN)) {
      BulkOperationResult result =
          repository.bulkUpdateColumns(
              null,
              null,
              new BulkColumnUpdateRequest()
                  .withColumnName("col_c")
                  .withTags(List.of(deprecatedLabel()))
                  .withDryRun(true));

      assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
      assertEquals(1, result.getNumberOfRowsPassed());
      assertEquals(1, result.getNumberOfRowsFailed());
      assertEquals(
          "Failed to update column %s: %s"
              .formatted(
                  NEW_COLUMN,
                  CatalogExceptionMessage.glossaryTermNotApproved(
                      DEPRECATED.getFullyQualifiedName(), EntityStatus.DEPRECATED)),
          result.getFailedRequest().getFirst().getMessage());
    }
  }

  private static List<GroupedColumnsResponse> termCatalog() {
    return List.of(
        group("col_c", occurrence(HELD_COLUMN, "table"), occurrence(NEW_COLUMN, "table")),
        group("col_d", occurrence("svc.db.schema.t1.col_d", "table")));
  }

  private static TagLabel deprecatedLabel() {
    return new TagLabel()
        .withTagFQN(DEPRECATED.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY);
  }

  // The term lookup and tag_usage are the boundaries; the stored state has the term on one column.
  private static MockedStatic<Entity> deprecatedTermHeldOn(String columnFqn) {
    String hash = FullyQualifiedName.buildHash(columnFqn);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    when(tagUsageDAO.getTagsByTargetFQNHashes(anyList()))
        .thenAnswer(
            invocation ->
                invocation.<List<String>>getArgument(0).contains(hash)
                    ? Map.of(hash, List.of(deprecatedLabel()))
                    : Map.of());
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    entity
        .when(
            () ->
                Entity.getEntityByNames(
                    eq(Entity.GLOSSARY_TERM), anyList(), eq(""), eq(Include.NON_DELETED)))
        .thenReturn(List.of(DEPRECATED));
    return entity;
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
