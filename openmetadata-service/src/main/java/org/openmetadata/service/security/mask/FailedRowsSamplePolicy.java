package org.openmetadata.service.security.mask;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.google.common.collect.Comparators;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/** Private failed-row storage and classification policy; no database or authorization operations. */
public final class FailedRowsSamplePolicy {
  private static final int LEGACY_FORMAT = 0;
  public static final int FORMAT_VERSION = 1;
  public static final int MAX_PATH_FACTS = 1000;
  public static final int MAX_RECORD_BYTES = 1024 * 1024;
  private static final String FORMAT_FIELD = "formatVersion";
  private static final ObjectMapper RECORD_MAPPER =
      JsonUtils.getObjectMapper()
          .copy()
          .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
          .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT);
  private static final ObjectReader SAMPLE_READER = RECORD_MAPPER.readerFor(SampleRecord.class);
  private static final ObjectReader REMOVAL_READER = RECORD_MAPPER.readerFor(RemovalRecord.class);

  private FailedRowsSamplePolicy() {}

  public enum Association {
    SOURCE,
    ADDITIONAL,
    AMBIGUOUS
  }

  public record Binding(Association association, List<List<String>> paths) {
    public Binding {
      if (association == null || paths == null) {
        throw new IllegalArgumentException("Invalid failed-row source binding");
      }
      paths = paths.stream().map(List::copyOf).toList();
      if ((association == Association.ADDITIONAL) != paths.isEmpty()
          || (association == Association.SOURCE && paths.size() != 1)
          || paths.stream().anyMatch(List::isEmpty)) {
        throw new IllegalArgumentException("Invalid failed-row source paths");
      }
    }
  }

  public record SampleRecord(
      @JsonProperty(value = "formatVersion", required = true) Integer formatVersion,
      TableData data,
      UUID tableId,
      @JsonProperty(value = "observedSequence", required = true) Long observedSequence,
      List<Binding> bindings) {
    public SampleRecord {
      if (formatVersion == null
          || observedSequence == null
          || data == null
          || data.getColumns() == null
          || data.getRows() == null
          || observedSequence < 0
          || bindings == null) {
        throw new IllegalArgumentException("Invalid failed-row sample record");
      }
      if (formatVersion != LEGACY_FORMAT
          && (formatVersion != FORMAT_VERSION
              || tableId == null
              || bindings.size() != data.getColumns().size())) {
        throw new IllegalArgumentException("Unsupported failed-row sample format");
      }
      bindings = List.copyOf(bindings);
    }

    private boolean isLegacy() {
      return formatVersion == LEGACY_FORMAT;
    }
  }

  public record RemovalFact(List<String> path, Boolean sensitive) {
    public RemovalFact {
      path = List.copyOf(path);
      if (path.isEmpty() || sensitive == null) {
        throw new IllegalArgumentException("Invalid failed-row removal fact");
      }
    }
  }

  public record RemovalBatch(
      @JsonProperty(value = "sequence", required = true) Long sequence, List<RemovalFact> facts) {
    public RemovalBatch {
      facts = List.copyOf(facts);
      if (sequence == null || sequence <= 0 || facts.isEmpty()) {
        throw new IllegalArgumentException("Invalid failed-row removal batch");
      }
    }
  }

  public record RemovalRecord(
      @JsonProperty(value = "formatVersion", required = true) Integer formatVersion,
      @JsonProperty(value = "sequence", required = true) Long sequence,
      @JsonProperty(value = "coverageThrough", required = true) Long coverageThrough,
      List<RemovalBatch> batches) {
    public RemovalRecord {
      if (formatVersion == null
          || sequence == null
          || coverageThrough == null
          || formatVersion != FORMAT_VERSION
          || sequence < 0
          || coverageThrough < 0
          || coverageThrough > sequence
          || batches == null) {
        throw new IllegalArgumentException("Invalid failed-row removal record");
      }
      batches = List.copyOf(batches);
      long previous = coverageThrough;
      for (RemovalBatch batch : batches) {
        if (batch.sequence() != previous + 1) {
          throw new IllegalArgumentException("Incomplete failed-row removal coverage");
        }
        previous = batch.sequence();
      }
      if (previous != sequence) {
        throw new IllegalArgumentException("Missing failed-row removal batch");
      }
    }
  }

  private record ColumnState(List<String> path, Column column, boolean inheritedSensitive) {}

  public static RemovalRecord emptyRecord() {
    return new RemovalRecord(FORMAT_VERSION, 0L, 0L, List.of());
  }

  public static SampleRecord bind(TableData data, Table table, RemovalRecord record) {
    List<ColumnState> columns = columns(table);
    List<Binding> bindings = data.getColumns().stream().map(name -> bind(name, columns)).toList();
    return new SampleRecord(FORMAT_VERSION, data, table.getId(), record.sequence(), bindings);
  }

  private static Binding bind(String name, List<ColumnState> columns) {
    List<List<String>> matches =
        columns.stream()
            .filter(column -> matchesLabel(name, column.path()))
            .map(ColumnState::path)
            .toList();
    Association association =
        matches.isEmpty()
            ? Association.ADDITIONAL
            : matches.size() == 1 ? Association.SOURCE : Association.AMBIGUOUS;
    return new Binding(association, matches);
  }

  private record BaselineColumn(
      List<String> path, String dataType, boolean sensitive, boolean inherited) {}

  public static boolean sameBaseline(Table original, Table current) {
    return directSensitive(original.getTags()) == directSensitive(current.getTags())
        && baseline(original).equals(baseline(current));
  }

  private static List<BaselineColumn> baseline(Table table) {
    return columns(table).stream()
        .map(
            state ->
                new BaselineColumn(
                    state.path(),
                    String.valueOf(state.column().getDataType()),
                    sensitive(state),
                    state.inheritedSensitive()))
        .toList();
  }

  public static boolean changesColumnPaths(Table original, Table updated) {
    return !columnPaths(original).equals(columnPaths(updated));
  }

  private static Set<List<String>> columnPaths(Table table) {
    Set<List<String>> paths =
        new TreeSet<>(Comparators.lexicographical(String.CASE_INSENSITIVE_ORDER));
    columns(table).forEach(column -> paths.add(column.path()));
    return paths;
  }

  public static RemovalRecord append(RemovalRecord record, Table original, Table updated) {
    Set<List<String>> after = columnPaths(updated);
    List<RemovalFact> facts =
        columns(original).stream()
            .filter(before -> !after.contains(before.path()))
            .map(before -> new RemovalFact(before.path(), sensitive(before)))
            .toList();
    if (facts.isEmpty()) {
      return record;
    }
    long sequence = Math.addExact(record.sequence(), 1);
    List<RemovalBatch> batches = new ArrayList<>(record.batches());
    batches.add(new RemovalBatch(sequence, facts));
    return bound(sequence, record.coverageThrough(), batches);
  }

  private static RemovalRecord bound(long sequence, long coverage, List<RemovalBatch> batches) {
    RemovalRecord result = new RemovalRecord(FORMAT_VERSION, sequence, coverage, batches);
    while (exceedsLimit(result)) {
      coverage = batches.removeFirst().sequence();
      result = new RemovalRecord(FORMAT_VERSION, sequence, coverage, batches);
    }
    return result;
  }

  private static boolean exceedsLimit(RemovalRecord record) {
    return record.batches().stream().mapToInt(batch -> batch.facts().size()).sum() > MAX_PATH_FACTS
        || JsonUtils.pojoToJson(record).getBytes(StandardCharsets.UTF_8).length > MAX_RECORD_BYTES;
  }

  public static SampleRecord decode(String json) {
    JsonNode node = JsonUtils.readTree(json);
    if (!node.isObject()) {
      throw new IllegalArgumentException("Invalid failed-row sample JSON");
    }
    if (node.has(FORMAT_FIELD)) {
      if (!node.get(FORMAT_FIELD).isIntegralNumber()
          || node.get(FORMAT_FIELD).intValue() != FORMAT_VERSION) {
        throw new IllegalArgumentException("Unsupported failed-row sample format");
      }
      return readPrivateRecord(json, SAMPLE_READER);
    }
    if (!node.has("columns") || !node.has("rows")) {
      throw new IllegalArgumentException("Unrecognized failed-row sample format");
    }
    return new SampleRecord(
        LEGACY_FORMAT, JsonUtils.readValue(json, TableData.class), null, 0L, List.of());
  }

  public static RemovalRecord decodeRemovalRecord(String json) {
    return readPrivateRecord(json, REMOVAL_READER);
  }

  private static <T> T readPrivateRecord(String json, ObjectReader reader) {
    try {
      T record = reader.readValue(json);
      if (record == null) {
        throw new IllegalArgumentException("Missing failed-row private record");
      }
      return record;
    } catch (JsonProcessingException failure) {
      throw new IllegalArgumentException("Invalid failed-row private record", failure);
    }
  }

  public static TableData mask(SampleRecord sample, Table table, RemovalRecord record) {
    if (sample.isLegacy() && record.coverageThrough() > 0) {
      throw new IllegalStateException(
          "Legacy failed-row sample requires replacement because removal evidence is incomplete");
    }
    TableData masked = JsonUtils.deepCopy(sample.data(), TableData.class);
    List<ColumnState> columns = columns(table);
    List<Boolean> positions = new ArrayList<>();
    for (int position = 0; position < masked.getColumns().size(); position++) {
      String name = masked.getColumns().get(position);
      boolean sensitive =
          directSensitive(table.getTags())
              || masksPosition(sample, position, table, columns, record);
      positions.add(sensitive);
      if (sensitive) {
        masked.getColumns().set(position, PIIMasker.flagMaskedName(name));
      }
    }
    masked.setRows(masked.getRows().stream().map(row -> maskRow(row, positions)).toList());
    return masked;
  }

  private static boolean masksPosition(
      SampleRecord sample,
      int position,
      Table table,
      List<ColumnState> columns,
      RemovalRecord record) {
    String name = sample.data().getColumns().get(position);
    if (sample.isLegacy()) {
      return currentAdditionalPolicy(name, table)
          || record.batches().stream()
              .flatMap(batch -> batch.facts().stream())
              .anyMatch(fact -> fact.sensitive() && legacyMatches(name, fact.path()));
    }
    Binding binding = sample.bindings().get(position);
    return switch (binding.association()) {
      case ADDITIONAL -> currentAdditionalPolicy(name, table);
      case AMBIGUOUS -> true;
      case SOURCE -> hasInvalidSourceEvidence(sample, table, record)
          || masksSource(binding.paths().getFirst(), sample.observedSequence(), columns, record);
    };
  }

  private static boolean hasInvalidSourceEvidence(
      SampleRecord sample, Table table, RemovalRecord record) {
    return !table.getId().equals(sample.tableId())
        || sample.observedSequence() > record.sequence()
        || sample.observedSequence() < record.coverageThrough();
  }

  private static boolean masksSource(
      List<String> path, long observed, List<ColumnState> columns, RemovalRecord record) {
    for (RemovalBatch batch : record.batches()) {
      if (batch.sequence() <= observed) {
        continue;
      }
      List<RemovalFact> ancestors =
          batch.facts().stream().filter(fact -> startsWith(path, fact.path())).toList();
      if (!ancestors.isEmpty()) {
        return ancestors.stream()
            .max(java.util.Comparator.comparingInt(fact -> fact.path().size()))
            .orElseThrow()
            .sensitive();
      }
      if (batch.facts().stream()
          .anyMatch(fact -> fact.sensitive() && startsWith(fact.path(), path))) {
        return true;
      }
    }
    ColumnState current = find(columns, path);
    return current == null || sensitive(current);
  }

  private static List<Object> maskRow(List<Object> row, List<Boolean> positions) {
    List<Object> masked = new ArrayList<>(row);
    for (int index = 0; index < masked.size(); index++) {
      if (positions.get(index)) {
        masked.set(index, PIIMasker.MASKED_VALUE);
      }
    }
    return masked;
  }

  private static boolean currentAdditionalPolicy(String name, Table table) {
    return listOrEmpty(table.getColumns()).stream()
        .anyMatch(
            column ->
                column.getName().equalsIgnoreCase(name) && PIIMasker.hasPiiSensitiveTag(column));
  }

  private static boolean legacyMatches(String name, List<String> path) {
    for (int length = 1; length <= path.size(); length++) {
      if (matchesLabel(name, path.subList(0, length))) {
        return true;
      }
    }
    return false;
  }

  private static boolean matchesLabel(String name, List<String> path) {
    return name != null
        && (FullyQualifiedName.build(path.toArray(String[]::new)).equalsIgnoreCase(name)
            || (path.size() == 1 && path.getFirst().equalsIgnoreCase(name)));
  }

  private static boolean startsWith(List<String> path, List<String> prefix) {
    if (prefix.size() > path.size()) {
      return false;
    }
    for (int index = 0; index < prefix.size(); index++) {
      if (!path.get(index).equalsIgnoreCase(prefix.get(index))) {
        return false;
      }
    }
    return true;
  }

  private static ColumnState find(List<ColumnState> columns, List<String> path) {
    return columns.stream()
        .filter(column -> column.path().size() == path.size() && startsWith(column.path(), path))
        .findFirst()
        .orElse(null);
  }

  private static List<ColumnState> columns(Table table) {
    List<ColumnState> result = new ArrayList<>();
    collect(listOrEmpty(table.getColumns()), List.of(), directSensitive(table.getTags()), result);
    return result;
  }

  private static void collect(
      List<Column> columns, List<String> parent, boolean inherited, List<ColumnState> result) {
    for (Column column : columns) {
      if (column == null) {
        continue;
      }
      List<String> path = new ArrayList<>(parent);
      path.add(column.getName());
      result.add(new ColumnState(List.copyOf(path), column, inherited));
      collect(
          listOrEmpty(column.getChildren()),
          path,
          inherited || directSensitive(column.getTags()),
          result);
    }
  }

  private static boolean sensitive(ColumnState state) {
    return state.inheritedSensitive() || PIIMasker.hasPiiSensitiveTag(state.column());
  }

  private static boolean directSensitive(List<TagLabel> tags) {
    return listOrEmpty(tags).stream()
        .anyMatch(tag -> PIIMasker.SENSITIVE_PII_TAG.equals(tag.getTagFQN()));
  }
}
