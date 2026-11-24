package org.openmetadata.service.security.mask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

class FailedRowsSamplePolicyTest {
  @ParameterizedTest
  @CsvSource({"true,true,true", "true,false,false", "false,false,false", "false,true,true"})
  void usesLastCommittedClassificationRatherThanUploadClassification(
      boolean initial, boolean beforeRemoval, boolean masked) {
    Table table = table(column("ssn", initial), column("email", false));
    TableData data = data("ssn", "email", "extra_column", "diffType");
    var sample = FailedRowsSamplePolicy.bind(data, table, FailedRowsSamplePolicy.emptyRecord());
    table.getColumns().getFirst().setTags(tags(beforeRemoval));
    Table replacement = table(column("email", false));
    var record =
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), table, replacement);
    TableData result = FailedRowsSamplePolicy.mask(sample, replacement, record);
    assertEquals(
        masked ? PIIMasker.MASKED_VALUE : "value-ssn", result.getRows().getFirst().getFirst());
    assertEquals(
        List.of("value-email", "value-extra_column", "value-diffType"),
        result.getRows().getFirst().subList(1, 4));
    assertEquals(data("ssn", "email", "extra_column", "diffType"), sample.data());
  }

  @Test
  void currentClassificationRemainsLiveUntilRemoval() {
    Table table = table(column("ssn", true));
    var sample =
        FailedRowsSamplePolicy.bind(data("ssn"), table, FailedRowsSamplePolicy.emptyRecord());
    table.getColumns().getFirst().setTags(List.of());
    assertEquals(
        "value-ssn",
        FailedRowsSamplePolicy.mask(sample, table, FailedRowsSamplePolicy.emptyRecord())
            .getRows()
            .getFirst()
            .getFirst());
  }

  @Test
  void firstRelevantRetirementSeparatesSavedSamplesAcrossNameReuse() {
    Table sensitive = table(column("ssn", true));
    var first =
        FailedRowsSamplePolicy.bind(data("ssn"), sensitive, FailedRowsSamplePolicy.emptyRecord());
    var record =
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), sensitive, table());
    Table plain = table(column("ssn", false));
    var second = FailedRowsSamplePolicy.bind(data("ssn"), plain, record);
    record = FailedRowsSamplePolicy.append(record, plain, table());
    assertEquals(
        PIIMasker.MASKED_VALUE,
        FailedRowsSamplePolicy.mask(first, table(), record).getRows().getFirst().getFirst());
    assertEquals(
        "value-ssn",
        FailedRowsSamplePolicy.mask(second, table(), record).getRows().getFirst().getFirst());
  }

  @Test
  void removedSensitiveChildMasksParentWithoutFreezingUnrelatedSibling() {
    Column parent =
        column("contact", false)
            .withChildren(
                new ArrayList<>(List.of(column("private", true), column("ordinary", false))));
    Table before = table(parent);
    var sample =
        FailedRowsSamplePolicy.bind(data("contact"), before, FailedRowsSamplePolicy.emptyRecord());
    Table after = table(column("contact", false).withChildren(List.of(column("private", true))));
    var record = FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, after);
    after.getColumns().getFirst().getChildren().getFirst().setTags(List.of());
    assertEquals(
        "value-contact",
        FailedRowsSamplePolicy.mask(sample, after, record).getRows().getFirst().getFirst());
    record =
        FailedRowsSamplePolicy.append(
            FailedRowsSamplePolicy.emptyRecord(),
            before,
            table(column("contact", false).withChildren(List.of(column("ordinary", false)))));
    assertEquals(
        PIIMasker.MASKED_VALUE,
        FailedRowsSamplePolicy.mask(sample, after, record).getRows().getFirst().getFirst());
  }

  @Test
  void datatypeChangesAreNotRetirements() {
    Table before = table(column("ssn", true));
    Table after = table(column("ssn", false).withDataType(ColumnDataType.INT));
    assertEquals(
        0,
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, after)
            .sequence());
  }

  @Test
  void literalDotsAndCaseAmbiguityBindOnlyRealPositions() {
    Table table = table(column("a.b", true), column("Name", false), column("NAME", false));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("a.b", "name", "extra"), table, FailedRowsSamplePolicy.emptyRecord());
    TableData masked =
        FailedRowsSamplePolicy.mask(sample, table, FailedRowsSamplePolicy.emptyRecord());
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, PIIMasker.MASKED_VALUE, "value-extra"),
        masked.getRows().getFirst());
  }

  @Test
  void legacyOnlyUsesCurrentAndMatchingSensitiveRetirementEvidence() {
    var record =
        FailedRowsSamplePolicy.append(
            FailedRowsSamplePolicy.emptyRecord(),
            table(column("ssn", true), column("email", false)),
            table());
    var legacy = FailedRowsSamplePolicy.decode(JsonUtils.pojoToJson(data("ssn", "email", "extra")));
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, "value-email", "value-extra"),
        FailedRowsSamplePolicy.mask(legacy, table(), record).getRows().getFirst());
    assertThrows(
        IllegalArgumentException.class,
        () -> FailedRowsSamplePolicy.decode("{\"formatVersion\":99}"));
  }

  @Test
  void incompleteCoverageOnlyMasksIdentifiedSources() {
    Table table = table(column("source", false));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("source", "extra"), table, FailedRowsSamplePolicy.emptyRecord());
    var record = new FailedRowsSamplePolicy.RemovalRecord(1, 1L, 1L, List.of());
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, "value-extra"),
        FailedRowsSamplePolicy.mask(sample, table, record).getRows().getFirst());
  }

  @Test
  void recordsRoundTripAndTableSensitivityStillMasksAdditionalOutputs() {
    Table table = table(column("source", false));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("source", "extra"), table, FailedRowsSamplePolicy.emptyRecord());
    assertEquals(sample, FailedRowsSamplePolicy.decode(JsonUtils.pojoToJson(sample)));
    table.setTags(tags(true));
    assertTrue(
        FailedRowsSamplePolicy.mask(sample, table, FailedRowsSamplePolicy.emptyRecord())
            .getRows()
            .getFirst()
            .stream()
            .allMatch(PIIMasker.MASKED_VALUE::equals));
  }

  @Test
  void rejectsExplicitLegacyAndMalformedEnvelopes() {
    assertThrows(
        IllegalArgumentException.class,
        () -> FailedRowsSamplePolicy.decode("{\"formatVersion\":0,\"columns\":[],\"rows\":[]}"));
    assertThrows(IllegalArgumentException.class, () -> FailedRowsSamplePolicy.decode("{}"));
    assertThrows(IllegalArgumentException.class, () -> FailedRowsSamplePolicy.decode("[]"));
  }

  @Test
  void recordedPlainRemovalSurvivesSensitiveReplacement() {
    Table before = table(column("ssn", false));
    var sample =
        FailedRowsSamplePolicy.bind(data("ssn"), before, FailedRowsSamplePolicy.emptyRecord());
    var record =
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, table());
    assertEquals(
        "value-ssn",
        FailedRowsSamplePolicy.mask(sample, table(column("ssn", true)), record)
            .getRows()
            .getFirst()
            .getFirst());
  }

  @Test
  void combinedTableUntagAndRemovalUsesCommittedTablePolicy() {
    Table before = table(column("ssn", false));
    before.setTags(tags(true));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("ssn", "extra"), before, FailedRowsSamplePolicy.emptyRecord());
    Table after = table();
    var record = FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, after);
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, "value-extra"),
        FailedRowsSamplePolicy.mask(sample, after, record).getRows().getFirst());
  }

  @Test
  void oversizedBatchAdvancesCoverageWithoutMaskingAdditionalOutputs() {
    List<Column> columns = new ArrayList<>();
    for (int index = 0; index <= FailedRowsSamplePolicy.MAX_PATH_FACTS; index++) {
      columns.add(column("column" + index, false));
    }
    Table before = table(columns.toArray(Column[]::new));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("column0", "extra"), before, FailedRowsSamplePolicy.emptyRecord());
    var record =
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, table());
    assertEquals(1, record.coverageThrough());
    assertTrue(record.batches().isEmpty());
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, "value-extra"),
        FailedRowsSamplePolicy.mask(sample, table(), record).getRows().getFirst());
  }

  @Test
  void incompleteLegacyEvidenceCannotExposePreviouslyProtectedValues() {
    var legacy = FailedRowsSamplePolicy.decode(JsonUtils.pojoToJson(data("ssn", "extra")));
    var record = new FailedRowsSamplePolicy.RemovalRecord(1, 1L, 1L, List.of());
    assertThrows(
        IllegalStateException.class, () -> FailedRowsSamplePolicy.mask(legacy, table(), record));
  }

  @Test
  void missingSensitivityAndMissingSampleSequenceAreRejected() {
    assertThrows(
        RuntimeException.class,
        () ->
            JsonUtils.readValue("{\"path\":[\"ssn\"]}", FailedRowsSamplePolicy.RemovalFact.class));
    var sample =
        FailedRowsSamplePolicy.bind(
            data("ssn"), table(column("ssn", false)), FailedRowsSamplePolicy.emptyRecord());
    var node = JsonUtils.valueToTree(sample);
    ((ObjectNode) node).remove("observedSequence");
    assertThrows(RuntimeException.class, () -> FailedRowsSamplePolicy.decode(node.toString()));
    ((ObjectNode) node).putNull("observedSequence");
    assertThrows(RuntimeException.class, () -> FailedRowsSamplePolicy.decode(node.toString()));
  }

  @Test
  void rejectsMissingOrNullRemovalBoundaryNumbers() {
    var record =
        FailedRowsSamplePolicy.append(
            FailedRowsSamplePolicy.emptyRecord(), table(column("ssn", true)), table());
    for (String field : List.of("formatVersion", "sequence", "coverageThrough")) {
      ObjectNode node = (ObjectNode) JsonUtils.valueToTree(record);
      node.remove(field);
      assertThrows(
          RuntimeException.class,
          () -> JsonUtils.readValue(node.toString(), FailedRowsSamplePolicy.RemovalRecord.class));
      node.putNull(field);
      assertThrows(
          RuntimeException.class,
          () -> JsonUtils.readValue(node.toString(), FailedRowsSamplePolicy.RemovalRecord.class));
    }
    assertThrows(
        RuntimeException.class,
        () ->
            JsonUtils.readValue(
                "{\"sequence\":null,\"facts\":[{\"path\":[\"ssn\"],\"sensitive\":false}]}",
                FailedRowsSamplePolicy.RemovalBatch.class));
  }

  @Test
  void rejectsScalarCoercionAtBothPrivateRecordBoundaries() {
    var sample =
        FailedRowsSamplePolicy.bind(
            data("ssn"), table(column("ssn", false)), FailedRowsSamplePolicy.emptyRecord());
    var record =
        FailedRowsSamplePolicy.append(
            FailedRowsSamplePolicy.emptyRecord(), table(column("ssn", true)), table());
    for (String value : List.of("0.5", "\"0\"", "null", "9223372036854775808", "true")) {
      ObjectNode sampleNode = (ObjectNode) JsonUtils.valueToTree(sample);
      sampleNode.set("observedSequence", JsonUtils.readTree(value));
      assertThrows(
          IllegalArgumentException.class,
          () -> FailedRowsSamplePolicy.decode(sampleNode.toString()));
      for (String field : List.of("formatVersion", "sequence", "coverageThrough")) {
        ObjectNode recordNode = (ObjectNode) JsonUtils.valueToTree(record);
        recordNode.set(field, JsonUtils.readTree(value));
        assertThrows(
            IllegalArgumentException.class,
            () -> FailedRowsSamplePolicy.decodeRemovalRecord(recordNode.toString()));
      }
    }
    for (String value : List.of("0", "1", "0.5", "\"false\"", "null")) {
      ObjectNode recordNode = (ObjectNode) JsonUtils.valueToTree(record);
      ((ObjectNode) recordNode.path("batches").get(0).path("facts").get(0))
          .set("sensitive", JsonUtils.readTree(value));
      assertThrows(
          IllegalArgumentException.class,
          () -> FailedRowsSamplePolicy.decodeRemovalRecord(recordNode.toString()));
    }
    assertThrows(
        IllegalArgumentException.class, () -> FailedRowsSamplePolicy.decodeRemovalRecord("null"));
  }

  @Test
  void strictMetadataReadersPreserveArbitraryRowObjects() {
    TableData data =
        new TableData()
            .withColumns(List.of("source"))
            .withRows(List.of(List.of(Map.of("number", 0.5, "text", "0", "boolean", true))));
    var record =
        FailedRowsSamplePolicy.bind(
            data, table(column("source", false)), FailedRowsSamplePolicy.emptyRecord());
    assertEquals(data, FailedRowsSamplePolicy.decode(JsonUtils.pojoToJson(record)).data());
  }

  @Test
  void wideReorderedCaseOnlySchemaPreservesRemovalRecord() {
    List<Column> before = new ArrayList<>();
    List<Column> after = new ArrayList<>();
    for (int index = 0; index < 1000; index++) {
      before.add(column("column" + index, true));
      after.add(column("COLUMN" + index, false).withDataType(ColumnDataType.INT));
    }
    Collections.reverse(after);
    assertUnchangedPaths(table(before.toArray(Column[]::new)), table(after.toArray(Column[]::new)));
  }

  @ParameterizedTest
  @CsvSource({"I,ı", "İ,i", "Σ,ς", "σ,Σ", "𐐀,𐐨"})
  void pathMembershipPreservesUnicodeCaseEquivalence(String original, String updated) {
    assertTrue(original.equalsIgnoreCase(updated));
    assertUnchangedPaths(
        table(column(original, true).withChildren(List.of(column("CHILD", true)))),
        table(column(updated, false).withChildren(List.of(column("child", false)))));
  }

  @Test
  void emptyAndDuplicatePathsKeepMembershipSemantics() {
    assertUnchangedPaths(table(), table());
    assertUnchangedPaths(
        table(column("Name", false), column("NAME", true)), table(column("name", false)));
    var record = FailedRowsSamplePolicy.emptyRecord();
    assertTrue(FailedRowsSamplePolicy.changesColumnPaths(table(), table(column("added", false))));
    assertSame(
        record, FailedRowsSamplePolicy.append(record, table(), table(column("added", false))));
    assertTrue(FailedRowsSamplePolicy.changesColumnPaths(table(column("removed", false)), table()));
    assertEquals(
        List.of(
            new FailedRowsSamplePolicy.RemovalFact(List.of("Name"), false),
            new FailedRowsSamplePolicy.RemovalFact(List.of("NAME"), true)),
        FailedRowsSamplePolicy.append(
                record, table(column("Name", false), column("NAME", true)), table())
            .batches()
            .getFirst()
            .facts());
  }

  @Test
  void literalDotsRemainDistinctFromNestedSegmentsDuringRemoval() {
    Table before =
        table(column("a.b", true), column("a", false).withChildren(List.of(column("b", false))));
    Table nestedOnly = table(column("A", false).withChildren(List.of(column("B", false))));
    assertTrue(FailedRowsSamplePolicy.changesColumnPaths(before, nestedOnly));
    assertEquals(
        List.of(new FailedRowsSamplePolicy.RemovalFact(List.of("a.b"), true)),
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, nestedOnly)
            .batches()
            .getFirst()
            .facts());
    Table literalOnly = table(column("A.B", false), column("a", false));
    assertEquals(
        List.of(new FailedRowsSamplePolicy.RemovalFact(List.of("a", "b"), false)),
        FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, literalOnly)
            .batches()
            .getFirst()
            .facts());
  }

  @Test
  void nestedRenamesPreserveFactOrderAndCommittedSensitivity() {
    Table before =
        table(
            column("parent", true)
                .withChildren(List.of(column("first", false), column("second", true))),
            column("plain", false));
    Table after = table(column("PARENT", false).withChildren(List.of(column("renamed", false))));
    assertTrue(FailedRowsSamplePolicy.changesColumnPaths(before, after));
    var record = FailedRowsSamplePolicy.append(FailedRowsSamplePolicy.emptyRecord(), before, after);
    assertEquals(1L, record.sequence());
    assertEquals(0L, record.coverageThrough());
    assertEquals(
        List.of(
            new FailedRowsSamplePolicy.RemovalFact(List.of("parent", "first"), true),
            new FailedRowsSamplePolicy.RemovalFact(List.of("parent", "second"), true),
            new FailedRowsSamplePolicy.RemovalFact(List.of("plain"), false)),
        record.batches().getFirst().facts());
  }

  private void assertUnchangedPaths(Table original, Table updated) {
    assertFalse(FailedRowsSamplePolicy.changesColumnPaths(original, updated));
    var record =
        FailedRowsSamplePolicy.append(
            FailedRowsSamplePolicy.emptyRecord(), table(column("retired", false)), table());
    assertSame(record, FailedRowsSamplePolicy.append(record, original, updated));
  }

  private Table table(Column... columns) {
    return new Table()
        .withId(UUID.fromString("11111111-1111-1111-1111-111111111111"))
        .withTags(new ArrayList<>())
        .withColumns(new ArrayList<>(List.of(columns)));
  }

  private Column column(String name, boolean sensitive) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.STRING)
        .withTags(tags(sensitive));
  }

  private List<TagLabel> tags(boolean sensitive) {
    return sensitive ? List.of(new TagLabel().withTagFQN(PIIMasker.SENSITIVE_PII_TAG)) : List.of();
  }

  private TableData data(String... names) {
    List<Object> row = new ArrayList<>();
    for (String name : names) {
      row.add("value-" + name);
    }
    return new TableData()
        .withColumns(new ArrayList<>(List.of(names)))
        .withRows(new ArrayList<>(List.of(row)));
  }
}
