package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityFieldTagReaderTest {
  private static final String TERM = "glossary.term";
  private static final String CLASSIFICATION = "PII.Sensitive";

  @Test
  void emptyInputsAndFieldsWithoutFqnsKeepExistingValuesWithoutReading() {
    final Fixture fixture = new Fixture();
    final Column missingFqn = new Column().withTags(List.of(tag(CLASSIFICATION)));
    fixture.reader.populate(null, Table::getColumns);
    fixture.reader.populate(List.<Table>of(), Table::getColumns);
    fixture.reader.populate(
        List.of(new Table(), table(List.of()), table(List.of(missingFqn))), Table::getColumns);
    assertEquals(List.of(tag(CLASSIFICATION)), missingFqn.getTags());
    assertTrue(fixture.queries.isEmpty());
    assertEquals(0, fixture.populations);
    assertEquals(0, fixture.derivations);
  }

  @Test
  void nestedFieldsKeepDiscoveryOrderAndShareOneReadForRepeatedFqns() {
    final Fixture fixture = new Fixture();
    final Column nested = column("table.parent.child");
    final Column parent = column("table.parent").withChildren(List.of(nested));
    final Column duplicate = column(nested.getFullyQualifiedName());
    fixture.labels.put(
        FullyQualifiedName.buildHash(nested.getFullyQualifiedName()), List.of(tag(CLASSIFICATION)));
    fixture.reader.populate(
        List.of(table(List.of(parent)), table(List.of(duplicate))), Table::getColumns);
    assertEquals(List.of(List.of("table.parent", "table.parent.child")), fixture.queries);
    assertTrue(parent.getTags().isEmpty());
    assertEquals(List.of(tag(CLASSIFICATION)), nested.getTags());
    assertEquals(nested.getTags(), duplicate.getTags());
    nested.getTags().clear();
    assertEquals(1, duplicate.getTags().size());
    assertEquals(1, fixture.populations);
    assertEquals(1, fixture.derivations);
  }

  @Test
  void queriesRetainTheirFiveThousandFqnLimitAndPopulateOnce() {
    final Fixture fixture = new Fixture();
    final List<Column> columns =
        IntStream.range(0, 10001).mapToObj(index -> column("table.column" + index)).toList();
    fixture.reader.populate(List.of(table(columns)), Table::getColumns);
    assertEquals(List.of(5000, 5000, 1), fixture.queries.stream().map(List::size).toList());
    assertEquals(
        columns.stream().map(Column::getFullyQualifiedName).toList(),
        fixture.queries.stream().flatMap(List::stream).toList());
    assertTrue(columns.stream().allMatch(column -> column.getTags().isEmpty()));
    assertEquals(1, fixture.populations);
    assertEquals(1, fixture.derivations);
  }

  @Test
  void derivedTagsAreMergedAndStaleDerivedLabelsAreRemoved() {
    final Fixture fixture = new Fixture();
    final Column column = column("table.column");
    final TagLabel term = tag(TERM).withSource(TagLabel.TagSource.GLOSSARY);
    fixture.labels.put(
        FullyQualifiedName.buildHash(column.getFullyQualifiedName()),
        List.of(term, tag("PII.Stale").withLabelType(TagLabel.LabelType.DERIVED)));
    fixture.derived =
        Map.of(
            FullyQualifiedName.buildHash(TERM),
            List.of(tag(CLASSIFICATION).withLabelType(TagLabel.LabelType.DERIVED)));
    fixture.reader.populate(List.of(table(List.of(column))), Table::getColumns);
    assertEquals(
        List.of(CLASSIFICATION, TERM), column.getTags().stream().map(TagLabel::getTagFQN).toList());
  }

  @Test
  void derivedReadFailuresRetainExplicitTagsWithoutIndividualFallbackQueries() {
    final Fixture fixture = new Fixture();
    final Column column = column("table.column");
    fixture.labels.put(
        FullyQualifiedName.buildHash(column.getFullyQualifiedName()),
        List.of(tag(CLASSIFICATION), tag("PII.Stale").withLabelType(TagLabel.LabelType.DERIVED)));
    fixture.deriveFailure = new IllegalArgumentException("Injected derived tag read failure");
    fixture.reader.populate(List.of(table(List.of(column))), Table::getColumns);
    assertEquals(List.of(tag(CLASSIFICATION)), column.getTags());
    assertEquals(1, fixture.queries.size());
    assertEquals(1, fixture.derivations);
  }

  @Test
  void missingFqnsInMixedBatchesReceiveTheirOwnMutableEmptyTags() {
    final Fixture fixture = new Fixture();
    final Column missing = new Column();
    final Column present = column("table.column");
    fixture.reader.populate(List.of(table(List.of(missing, present))), Table::getColumns);
    missing.getTags().add(tag(CLASSIFICATION));
    assertTrue(present.getTags().isEmpty());
    assertEquals(List.of(List.of("table.column")), fixture.queries);
  }

  @Test
  void queryFailureLeavesFieldsUntouchedAndPropagates() {
    final Fixture fixture = new Fixture();
    final RuntimeException failure = new IllegalStateException("Injected tag query failure");
    when(fixture.dao.getTagsInternalBatch(anyList())).thenThrow(failure);
    final List<TagLabel> originalTags = List.of(tag(CLASSIFICATION));
    final Column column = column("table.column").withTags(originalTags);
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.reader.populate(List.of(table(List.of(column))), Table::getColumns)));
    assertSame(originalTags, column.getTags());
    assertEquals(0, fixture.derivations);
  }

  private static Column column(final String fqn) {
    return new Column().withName("field").withFullyQualifiedName(fqn);
  }

  private static Table table(final List<Column> columns) {
    return new Table().withColumns(columns);
  }

  private static TagLabel tag(final String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static final class Fixture {
    private final TagUsageDAO dao = mock(TagUsageDAO.class);
    private final List<List<String>> queries = new ArrayList<>();
    private final Map<String, List<TagLabel>> labels = new HashMap<>();
    private Map<String, List<TagLabel>> derived = Map.of();
    private RuntimeException deriveFailure;
    private int populations;
    private int derivations;
    private final EntityFieldTagReader reader =
        new EntityFieldTagReader(
            () -> dao,
            new EntityFieldTagReader.Hydration(
                rows -> {
                  populations++;
                  return labels;
                },
                tags -> {
                  derivations++;
                  if (deriveFailure != null) {
                    throw deriveFailure;
                  }
                  return derived;
                },
                TagLabelUtil::addDerivedTagsWithPreFetched));

    private Fixture() {
      when(dao.getTagsInternalBatch(anyList()))
          .thenAnswer(
              invocation -> {
                queries.add(List.copyOf(invocation.getArgument(0)));
                return queries.size() == 1 ? null : List.of();
              });
    }
  }
}
