package org.openmetadata.it.tests;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Tag("benchmark")
class DeepCopyBenchmarkIT {

  private static final Logger LOG = LoggerFactory.getLogger(DeepCopyBenchmarkIT.class);

  @Test
  void benchmarkDeepCopy() {
    Table smallTable = buildTable(3, 0, "small_table");
    Table mediumTable = buildTable(20, 3, "medium_table");
    Table largeTable = buildTable(100, 5, "large_table");
    Table xlTable = buildTable(300, 5, "xl_table");

    String smallJson = JsonUtils.pojoToJson(smallTable);
    String mediumJson = JsonUtils.pojoToJson(mediumTable);
    String largeJson = JsonUtils.pojoToJson(largeTable);
    String xlJson = JsonUtils.pojoToJson(xlTable);

    LOG.info("=== Entity Sizes (JSON bytes) ===");
    LOG.info("  small  (3 cols, 0 tags/col):   {} bytes", smallJson.length());
    LOG.info("  medium (20 cols, 3 tags/col):   {} bytes", mediumJson.length());
    LOG.info("  large  (100 cols, 5 tags/col):  {} bytes", largeJson.length());
    LOG.info("  xl     (300 cols, 5 tags/col):  {} bytes", xlJson.length());

    LOG.info("\n=== Warmup (1000 iterations each) ===");
    for (int i = 0; i < 1000; i++) {
      JsonUtils.deepCopy(smallTable, Table.class);
      JsonUtils.deepCopy(mediumTable, Table.class);
      JsonUtils.deepCopy(largeTable, Table.class);
    }
    for (int i = 0; i < 500; i++) {
      JsonUtils.deepCopy(xlTable, Table.class);
    }
    LOG.info("  Warmup complete");

    int iterations = 500;
    LOG.info("\n=== deepCopy via convertValue + BlackbirdModule ({} iterations) ===", iterations);

    benchmarkEntity("small  (3 cols, 0 tags)", smallTable, iterations);
    benchmarkEntity("medium (20 cols, 3 tags)", mediumTable, iterations);
    benchmarkEntity("large  (100 cols, 5 tags)", largeTable, iterations);
    benchmarkEntity("xl     (300 cols, 5 tags)", xlTable, iterations);

    LOG.info("\n=== Old approach: pojoToJson + readValue ({} iterations) ===", iterations);
    benchmarkOldApproach("small  (3 cols, 0 tags)", smallTable, iterations);
    benchmarkOldApproach("medium (20 cols, 3 tags)", mediumTable, iterations);
    benchmarkOldApproach("large  (100 cols, 5 tags)", largeTable, iterations);
    benchmarkOldApproach("xl     (300 cols, 5 tags)", xlTable, iterations);

    LOG.info("\n=== Single-call worst case (no warmup, simulating cold path) ===");
    Table freshTable = buildTable(100, 5, "fresh_cold");
    long start = System.nanoTime();
    JsonUtils.deepCopy(freshTable, Table.class);
    long coldTime = System.nanoTime() - start;
    LOG.info("  Cold single deepCopy (100 cols, 5 tags): {}", formatNanos(coldTime));
  }

  private void benchmarkEntity(String label, Table entity, int iterations) {
    long[] times = new long[iterations];
    for (int i = 0; i < iterations; i++) {
      long start = System.nanoTime();
      JsonUtils.deepCopy(entity, Table.class);
      times[i] = System.nanoTime() - start;
    }
    printStats(label, times);
  }

  private void benchmarkOldApproach(String label, Table entity, int iterations) {
    long[] times = new long[iterations];
    for (int i = 0; i < iterations; i++) {
      long start = System.nanoTime();
      String json = JsonUtils.pojoToJson(entity);
      JsonUtils.readValue(json, Table.class);
      times[i] = System.nanoTime() - start;
    }
    printStats(label + " [OLD]", times);
  }

  private void printStats(String label, long[] timesNs) {
    java.util.Arrays.sort(timesNs);
    long min = timesNs[0];
    long p50 = timesNs[timesNs.length / 2];
    long p90 = timesNs[(int) (timesNs.length * 0.9)];
    long p99 = timesNs[(int) (timesNs.length * 0.99)];
    long max = timesNs[timesNs.length - 1];
    long sum = 0;
    for (long t : timesNs) sum += t;
    double avg = (double) sum / timesNs.length;

    LOG.info(
        "  {} => avg: {}, p50: {}, p90: {}, p99: {}, min: {}, max: {}",
        label,
        formatNanos(avg),
        formatNanos(p50),
        formatNanos(p90),
        formatNanos(p99),
        formatNanos(min),
        formatNanos(max));
  }

  private String formatNanos(double nanos) {
    if (nanos < 1_000) return String.format("%.0fns", nanos);
    if (nanos < 1_000_000) return String.format("%.1fus", nanos / 1_000);
    return String.format("%.2fms", nanos / 1_000_000);
  }

  private String formatNanos(long nanos) {
    return formatNanos((double) nanos);
  }

  private Table buildTable(int numColumns, int tagsPerColumn, String name) {
    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setName(name);
    table.setFullyQualifiedName("service.database.schema." + name);
    table.setDisplayName("Benchmark " + name);
    table.setDescription("A benchmark table with " + numColumns + " columns for deepCopy testing");
    table.setTableType(TableType.Regular);
    table.setVersion(1.0);
    table.setUpdatedAt(System.currentTimeMillis());
    table.setUpdatedBy("admin");
    table.setDeleted(false);

    table.setService(
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("databaseService")
            .withName("benchmark-service")
            .withFullyQualifiedName("benchmark-service"));
    table.setDatabase(
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("database")
            .withName("benchmark-db")
            .withFullyQualifiedName("benchmark-service.benchmark-db"));
    table.setDatabaseSchema(
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("databaseSchema")
            .withName("public")
            .withFullyQualifiedName("benchmark-service.benchmark-db.public"));

    List<EntityReference> owners = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      owners.add(
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType("user")
              .withName("owner_" + i)
              .withFullyQualifiedName("owner_" + i));
    }
    table.setOwners(owners);

    List<TagLabel> tableTags = new ArrayList<>();
    tableTags.add(
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED)
            .withSource(TagLabel.TagSource.CLASSIFICATION));
    tableTags.add(
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED)
            .withSource(TagLabel.TagSource.CLASSIFICATION));
    table.setTags(tableTags);

    List<Column> columns = new ArrayList<>();
    ColumnDataType[] types = {
      ColumnDataType.BIGINT,
      ColumnDataType.VARCHAR,
      ColumnDataType.TIMESTAMP,
      ColumnDataType.DOUBLE,
      ColumnDataType.BOOLEAN,
      ColumnDataType.INT,
      ColumnDataType.DATE,
      ColumnDataType.ARRAY
    };

    for (int i = 0; i < numColumns; i++) {
      Column col = new Column();
      col.setName("column_" + String.format("%03d", i));
      col.setDataType(types[i % types.length]);
      col.setDataTypeDisplay(types[i % types.length].value());
      col.setDescription("Column " + i + " description for testing deepCopy performance");
      col.setFullyQualifiedName(
          "service.database.schema." + name + ".column_" + String.format("%03d", i));
      col.setOrdinalPosition(i + 1);

      if (tagsPerColumn > 0) {
        List<TagLabel> colTags = new ArrayList<>();
        for (int t = 0; t < tagsPerColumn; t++) {
          colTags.add(
              new TagLabel()
                  .withTagFQN("Classification" + t + ".Tag" + t)
                  .withLabelType(TagLabel.LabelType.MANUAL)
                  .withState(TagLabel.State.CONFIRMED)
                  .withSource(TagLabel.TagSource.CLASSIFICATION));
        }
        col.setTags(colTags);
      }
      columns.add(col);
    }
    table.setColumns(columns);

    List<TableConstraint> constraints = new ArrayList<>();
    TableConstraint pk = new TableConstraint();
    pk.setConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY);
    pk.setColumns(List.of("column_000"));
    constraints.add(pk);
    table.setTableConstraints(constraints);

    table.setDomains(
        List.of(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType("domain")
                .withName("Engineering")
                .withFullyQualifiedName("Engineering")));

    return table;
  }
}
