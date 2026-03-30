package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.type.Include;

/**
 * A ListFilter that adds an upper-bound keyset condition to the WHERE clause. Used by
 * multi-reader reindexing to partition entity reads at the SQL level, ensuring the DB collation
 * handles all ordering comparisons — no Java-side cursor comparison needed.
 */
public class BoundedListFilter extends ListFilter {

  private final String endName;
  private final String endId;

  public BoundedListFilter(Include include, String endName, String endId) {
    super(include);
    this.endName = endName;
    this.endId = endId;
    addQueryParam("reindexEndName", endName);
    addQueryParam("reindexEndId", endId);
  }

  @Override
  public String getCondition(String tableName) {
    String base = super.getCondition(tableName);
    String nameCol = tableName == null ? "name" : tableName + ".name";
    String idCol = tableName == null ? "id" : tableName + ".id";
    return base
        + String.format(
            " AND (%s < :reindexEndName OR (%s = :reindexEndName AND %s <= :reindexEndId))",
            nameCol, nameCol, idCol);
  }
}
