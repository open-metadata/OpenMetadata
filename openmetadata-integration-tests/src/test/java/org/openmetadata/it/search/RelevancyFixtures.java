package org.openmetadata.it.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Shared seed + wait helpers for the search-relevancy ITs: a controlled cohort of tables that share
 * a searchable marker (so one query matches them all) and differ only in the field under test (e.g.
 * tier), plus a poll that blocks until the cohort is live-indexed and countable.
 */
public final class RelevancyFixtures {

  private static final String TABLE_INDEX = "table";

  private RelevancyFixtures() {}

  /**
   * Creates a table whose {@code description} carries {@code marker} (so a {@code q=marker} search
   * matches it), optionally tagged with a tier. The parent schema is tracked for cleanup by its
   * factory.
   */
  public static Table createTable(
      final DatabaseSchema schema, final String name, final String marker, final String tierFqn) {
    final CreateTable request =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription(marker)
            .withColumns(List.of(new Column().withName("c1").withDataType(ColumnDataType.STRING)));
    if (tierFqn != null) {
      request.withTags(List.of(tierLabel(tierFqn)));
    }
    return SdkClients.adminClient().tables().create(request);
  }

  /** Reports a daily usage count so the table's {@code usageSummary.weeklyStats.count} becomes nonzero. */
  public static void reportUsage(final Table table, final int count) {
    final DailyCount usage = new DailyCount().withDate(LocalDate.now().toString()).withCount(count);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/usage/table/" + table.getId(), usage, EntityUsage.class);
  }

  /** A short token with no shared substring across calls — safe to use as a search query marker. */
  public static String uniqueToken(final String prefix) {
    return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
  }

  public static TagLabel tierLabel(final String tierFqn) {
    return new TagLabel()
        .withTagFQN(tierFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  /** Blocks until exactly {@code expected} tables whose name starts with {@code namePrefix} index. */
  public static void awaitTablesIndexed(
      final IndexAliasInspector indices,
      final SearchAssertions search,
      final String namePrefix,
      final int expected,
      final Duration timeout) {
    final String index = indices.indexNameFor(TABLE_INDEX);
    Awaitility.await("tables with prefix '" + namePrefix + "' indexed")
        .atMost(timeout)
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () -> assertThat(search.countByNamePrefix(index, namePrefix)).isEqualTo(expected));
  }
}
