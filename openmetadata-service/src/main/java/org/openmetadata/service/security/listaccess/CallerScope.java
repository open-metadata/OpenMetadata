package org.openmetadata.service.security.listaccess;

import java.util.List;
import org.openmetadata.schema.type.MetadataOperation;

/**
 * The rows of one listed type that a caller may read, as the condition every list query of the type
 * appends (ADR:2026-11-09-a-listing-filters-its-rows-in-sql-through-a-required-access-scope). An
 * inexact scope selects a superset, and the listing checks each returned row as before.
 */
public final class CallerScope {
  private static final CallerScope ALL_ROWS =
      new CallerScope(null, RowFilter.ALL_ROWS, true, List.of());
  private static final CallerScope EACH_ROW_CHECKED =
      new CallerScope(null, RowFilter.ALL_ROWS, false, List.of());
  private static final String NO_ROW = "FALSE";

  private final RowStorage storage;
  private final RowFilter rows;
  private final boolean exact;
  private final List<MetadataOperation> operations;

  private CallerScope(
      RowStorage storage, RowFilter rows, boolean exact, List<MetadataOperation> operations) {
    this.storage = storage;
    this.rows = rows;
    this.exact = exact;
    this.operations = List.copyOf(operations);
  }

  /**
   * The rows the caller's policies allow for {@code operations}, read from {@code storage}. A plan
   * that allows no row keeps today's checks: the entry check refuses a listing of the type, and a
   * listing through another entity checks each row, so a reviewer still reads the rows they review.
   */
  static CallerScope compiled(
      RowStorage storage, RowFilter rows, List<MetadataOperation> operations) {
    return rows instanceof RowFilter.NoRows
        ? EACH_ROW_CHECKED
        : new CallerScope(storage, rows, rows.exact(), operations);
  }

  /** Every row, with no check after the query: the caller may read them all. */
  public static CallerScope allRows() {
    return ALL_ROWS;
  }

  /** Every row, each checked after the query by the authorizer, which decides rows one at a time. */
  public static CallerScope eachRowChecked() {
    return EACH_ROW_CHECKED;
  }

  /**
   * Whether the caller's policies allow some row for each of {@code listingOperations}, which
   * authorizes the listing in place of the check on the type alone: that check cannot see the rows
   * a condition allows. An empty listing is then the answer, and a refused one stays an error.
   */
  public boolean authorizesListing(List<MetadataOperation> listingOperations) {
    return storage != null && operations.containsAll(listingOperations);
  }

  /** The query decides every row as {@code authorize} decides it, so no row needs a check after. */
  public boolean exact() {
    return exact;
  }

  /** Whether the rows depend on who lists them, so a count of them is not shared between callers. */
  public boolean filtersRows() {
    return !(rows instanceof RowFilter.AllRows);
  }

  /**
   * The condition on the listed table, which {@code qualifier} names in the query. Empty when the
   * caller may read every row.
   */
  public String sqlCondition(String qualifier) {
    return switch (rows) {
      case RowFilter.AllRows ignored -> "";
      case RowFilter.NoRows ignored -> NO_ROW;
      case RowFilter.Where where -> whereCondition(where.predicate(), qualifier);
    };
  }

  /**
   * Unqualified columns inside the condition's subqueries would bind to the subquery's tables, so
   * a query that does not name its table cannot carry the condition. An inexact scope only narrows
   * the rows that are each checked after the query, so such a query reads them all; an exact scope
   * has no check after it, so the query fails rather than return rows the caller may not read.
   */
  private String whereCondition(RowPredicate predicate, String qualifier) {
    boolean named = qualifier != null && !qualifier.isBlank();
    if (!named && exact) {
      throw new IllegalStateException(
          "A list query of " + storage.entityType() + " rows must name its table to apply access");
    }
    return named
        ? "(" + new SqlRowFilterRenderer().render(predicate, storage, qualifier) + ")"
        : "";
  }
}
