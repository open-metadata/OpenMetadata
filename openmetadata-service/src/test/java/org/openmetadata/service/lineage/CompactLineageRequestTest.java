package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.junit.jupiter.api.Test;

class CompactLineageRequestTest {

  /**
   * REST binds an empty {@code ?column=} as "", MCP drops a blank param. Both must mean "no column",
   * not "the column named empty string", which used to answer REST callers with a 400.
   */
  @Test
  void aBlankColumnMeansNoColumn() {
    CompactLineageRequest request =
        CompactLineageRequest.builder().entityType("table").fqn("db.s.orders").column("  ").build();

    assertNull(request.column());
    assertFalse(request.edgeOptions().includeColumnLineage(), "no column, so no forced mappings");
  }

  @Test
  void aRequestBuiltWithoutAFilterFiltersNothing() {
    CompactLineageRequest request =
        CompactLineageRequest.builder().entityType("table").fqn("db.s.orders").build();

    assertSame(LineageEdgeFilter.NONE, request.edgeFilter());
  }
}
