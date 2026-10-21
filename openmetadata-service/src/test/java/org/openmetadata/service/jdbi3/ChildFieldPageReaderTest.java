package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Task;

/**
 * Covers the ordering and page-boundary rules that the two existing paginated column endpoints
 * relied on inline. The endpoints disagree on ordering by design, so both the sorted and the
 * stored-order paths are pinned here rather than only through the integration suite.
 */
class ChildFieldPageReaderTest {

  @Test
  void sortChildFields_nullSortBy_preservesStoredOrder() {
    // The dashboard data-model endpoint depends on this: it passes no sortBy and its callers see
    // whatever order the columns were stored in.
    List<FieldInterface> children =
        List.of(new Column().withName("b_col"), new Column().withName("a_col"));
    List<FieldInterface> sorted = ChildFieldPageReader.sortChildFields(children, null, null);
    assertEquals("b_col", sorted.get(0).getName());
    assertEquals("a_col", sorted.get(1).getName());
  }

  @Test
  void sortChildFields_doesNotMutateItsInput() {
    // The list handed in is the entity's own child collection. Sorting it in place would reorder
    // the stored entity for every later reader in the same request.
    List<FieldInterface> children =
        new ArrayList<>(List.of(new Column().withName("b_col"), new Column().withName("a_col")));
    ChildFieldPageReader.sortChildFields(children, "name", "asc");
    assertEquals("b_col", children.get(0).getName());
  }

  @Test
  void sortChildFields_nameSortAscending_caseInsensitive() {
    List<FieldInterface> children =
        List.of(new Column().withName("Zebra"), new Column().withName("apple"));
    List<FieldInterface> sorted = ChildFieldPageReader.sortChildFields(children, "name", null);
    assertEquals("apple", sorted.get(0).getName());
    assertEquals("Zebra", sorted.get(1).getName());
  }

  @Test
  void sortChildFields_unrecognisedSortBy_fallsBackToName() {
    // sortBy is documentation, not a validated enum, so an unknown value must sort by name rather
    // than fail. Tightening this into an error would be a wire change on the frozen endpoints.
    List<FieldInterface> children =
        List.of(new Column().withName("b_col"), new Column().withName("a_col"));
    List<FieldInterface> sorted = ChildFieldPageReader.sortChildFields(children, "banana", null);
    assertEquals("a_col", sorted.get(0).getName());
  }

  @Test
  void sortChildFields_descSortOrder_isCaseInsensitiveAndReversed() {
    List<FieldInterface> children =
        List.of(new Column().withName("apple"), new Column().withName("Zebra"));
    List<FieldInterface> sorted = ChildFieldPageReader.sortChildFields(children, "name", "DESC");
    assertEquals("Zebra", sorted.get(0).getName());
    assertEquals("apple", sorted.get(1).getName());
  }

  @Test
  void childComparator_ordinalPosition_nullsLast() {
    Column withPosition = new Column().withName("id").withOrdinalPosition(1);
    Column withoutPosition = new Column().withName("extra");
    List<FieldInterface> sorted =
        new ArrayList<>(List.<FieldInterface>of(withoutPosition, withPosition));
    sorted.sort(ChildFieldPageReader.childComparator("ordinalPosition"));
    assertEquals("id", sorted.get(0).getName());
    assertEquals("extra", sorted.get(1).getName());
  }

  @Test
  void childComparator_ordinalPosition_nonColumnChildrenSortAsNull() {
    // A pipeline task is a child field but not a Column. Sorting a page of them by ordinalPosition
    // must treat the position as absent rather than throw.
    Task task = new Task().withName("t1");
    Column withPosition = new Column().withName("id").withOrdinalPosition(1);
    List<FieldInterface> sorted = new ArrayList<>(List.<FieldInterface>of(withPosition, task));
    sorted.sort(ChildFieldPageReader.childComparator("ordinalPosition"));
    assertEquals("id", sorted.get(0).getName());
    assertEquals("t1", sorted.get(1).getName());
  }

  @Test
  void childComparator_nameSort_toleratesANullName() {
    Column named = new Column().withName("id");
    Column unnamed = new Column();
    List<FieldInterface> sorted = new ArrayList<>(List.<FieldInterface>of(unnamed, named));
    sorted.sort(ChildFieldPageReader.childComparator("name"));
    assertEquals("id", sorted.get(0).getName());
  }

  @Test
  void clampPageBounds_withinRange_returnsRequestedWindow() {
    int[] bounds = ChildFieldPageReader.clampPageBounds(2, 3, 10);
    assertEquals(2, bounds[0]);
    assertEquals(5, bounds[1]);
  }

  @Test
  void clampPageBounds_offsetPastEnd_returnsEmptyWindowAtTotal() {
    // Without the clamp this is an IndexOutOfBoundsException on the subList that follows.
    int[] bounds = ChildFieldPageReader.clampPageBounds(20, 5, 10);
    assertEquals(10, bounds[0]);
    assertEquals(10, bounds[1]);
  }

  @Test
  void clampPageBounds_limitPastEnd_clampsToIndexAtTotal() {
    int[] bounds = ChildFieldPageReader.clampPageBounds(8, 5, 10);
    assertEquals(8, bounds[0]);
    assertEquals(10, bounds[1]);
  }

  @Test
  void clampPageBounds_emptyCollection_returnsZeroWindow() {
    int[] bounds = ChildFieldPageReader.clampPageBounds(0, 50, 0);
    assertEquals(0, bounds[0]);
    assertEquals(0, bounds[1]);
  }

  @Test
  void childPageEnricher_none_returnsThePageUnchanged() {
    // The seven entity types that need no enrichment share this instance, so it must be a pure
    // pass-through rather than, say, an empty list.
    List<FieldInterface> page = List.of(new Column().withName("id"));
    assertEquals(page, ChildFieldPageReader.ChildPageEnricher.NONE.enrich(null, page, "tags"));
  }

  @Test
  void childComparator_isReusableAcrossSorts() {
    // sortChildFields reverses the comparator for desc; a stateful comparator would corrupt a
    // second sort with the same instance.
    Comparator<FieldInterface> comparator = ChildFieldPageReader.childComparator("name");
    List<FieldInterface> first =
        new ArrayList<>(
            List.<FieldInterface>of(new Column().withName("b"), new Column().withName("a")));
    List<FieldInterface> second =
        new ArrayList<>(
            List.<FieldInterface>of(new Column().withName("d"), new Column().withName("c")));
    first.sort(comparator);
    second.sort(comparator);
    assertEquals("a", first.get(0).getName());
    assertEquals("c", second.get(0).getName());
  }
}
