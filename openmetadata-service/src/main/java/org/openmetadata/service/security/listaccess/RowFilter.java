package org.openmetadata.service.security.listaccess;

/** The rows of one listed type that a caller may read, decided before the query runs. */
public sealed interface RowFilter permits RowFilter.AllRows, RowFilter.NoRows, RowFilter.Where {
  RowFilter ALL_ROWS = new AllRows();
  RowFilter NO_ROWS = new NoRows();

  record AllRows() implements RowFilter {}

  record NoRows() implements RowFilter {}

  /** Never holds a constant: {@link #of} turns TRUE into all rows and FALSE into none. */
  record Where(RowPredicate predicate) implements RowFilter {
    public Where {
      if (predicate instanceof RowPredicate.Const) {
        throw new IllegalArgumentException("A constant plan is AllRows or NoRows, not Where");
      }
    }
  }

  static RowFilter of(RowPredicate predicate) {
    return switch (predicate) {
      case RowPredicate.Const constant -> constant.value() ? ALL_ROWS : NO_ROWS;
      default -> new Where(predicate);
    };
  }

  /** Whether SQL decides every row as {@code authorize} does, so no row needs a per-row check. */
  default boolean exact() {
    return !(this instanceof Where where) || RowPredicate.exact(where.predicate());
  }
}
