package org.openmetadata.service.migration.utils;

import java.util.List;
import org.openmetadata.service.util.EntityUtil;

/**
 * Statements the migration runner executes, records and skips together. A MySQL guarded block
 * ({@code SET @v}, {@code PREPARE}, {@code EXECUTE}, {@code DEALLOCATE}) only works when all of its
 * statements run on one connection, so it is one unit. Every other statement is a unit of its own,
 * whose text and checksum are the statement's, as they were before units existed. The checksum is
 * a stored format: ADR:2026-10-22-mysql-guarded-blocks-run-as-one-migration-unit.
 */
public record SqlUnit(List<String> statements) {

  public SqlUnit {
    statements = List.copyOf(statements);
  }

  public static SqlUnit of(String statement) {
    return new SqlUnit(List.of(statement));
  }

  public String text() {
    return String.join(";\n", statements);
  }

  public String checksum() {
    return EntityUtil.hash(text());
  }

  public boolean isBlock() {
    return statements.size() > 1;
  }
}
