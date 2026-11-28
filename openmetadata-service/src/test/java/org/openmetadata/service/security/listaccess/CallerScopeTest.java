package org.openmetadata.service.security.listaccess;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Own;

/** What a listing does with the scope compiled for its caller. */
class CallerScopeTest {
  private static final List<MetadataOperation> VIEW = List.of(MetadataOperation.VIEW_BASIC);
  private static final RowStorage TABLES =
      new RowStorage(
          Entity.TABLE, "table_entity", "fqnHash", new Absent(), new Own(), new Absent(), false);

  @Test
  void aCallerWhoMayReadEveryRowGetsNoCondition() {
    CallerScope everyRow = CallerScope.compiled(TABLES, RowFilter.ALL_ROWS, VIEW);

    assertEquals("", everyRow.sqlCondition(null));
    assertTrue(everyRow.exact());
    assertTrue(everyRow.authorizesListing(VIEW));
  }

  @Test
  void aPlanThatAllowsNoRowLeavesTheListingToTheEntryCheckAndTheRowChecks() {
    CallerScope refused = CallerScope.compiled(TABLES, RowFilter.NO_ROWS, VIEW);

    assertEquals("", refused.sqlCondition(null));
    assertFalse(refused.exact());
    assertFalse(refused.authorizesListing(VIEW));
  }

  @Test
  void aScopeAuthorizesAListingOnlyForTheOperationsItWasCompiledFor() {
    CallerScope undomained = CallerScope.compiled(TABLES, RowFilter.of(new NoDomain()), VIEW);
    List<MetadataOperation> viewWithUsage =
        List.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_USAGE);

    assertTrue(undomained.authorizesListing(VIEW));
    assertFalse(undomained.authorizesListing(viewWithUsage));
  }

  @Test
  void anInexactScopeLeavesAQueryThatNamesNoTableToTheRowChecks() {
    CallerScope unknownTags =
        CallerScope.compiled(TABLES, RowFilter.of(RowPredicate.unknown(ApproxReason.TAGS)), VIEW);

    assertFalse(unknownTags.exact());
    assertEquals("", unknownTags.sqlCondition(null));
    assertEquals("(TRUE)", unknownTags.sqlCondition("table_entity"));
  }

  @Test
  void aScopeTheAuthorizerCannotCompileChecksEachRowAndAuthorizesNothing() {
    CallerScope perRow = CallerScope.eachRowChecked();

    assertEquals("", perRow.sqlCondition("table_entity"));
    assertFalse(perRow.exact());
    assertFalse(perRow.authorizesListing(VIEW));
  }
}
