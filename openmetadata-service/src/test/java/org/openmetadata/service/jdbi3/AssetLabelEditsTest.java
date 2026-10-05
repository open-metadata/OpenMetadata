package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;

class AssetLabelEditsTest {
  private static final String TABLE_FQN = "svc.db.schema.orders";
  private static final String TAG_FQN = "PII.Sensitive";

  @Test
  void addAppendsTheLabelToTheAsset() {
    Table table = table(List.of(), column("id", List.of()));

    AssetLabelEdits.add(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertEquals(List.of(TAG_FQN), fqns(table.getTags()));
  }

  @Test
  void addIsANoOpWhenTheAssetAlreadyCarriesTheLabel() {
    List<TagLabel> tags = mutable(label(LabelType.AUTOMATED));
    Table table = table(tags, column("id", List.of()));

    AssetLabelEdits.add(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertEquals(1, table.getTags().size());
    assertEquals(LabelType.AUTOMATED, table.getTags().get(0).getLabelType());
  }

  @Test
  void addTargetsOnlyTheNamedColumn() {
    Column id = column("id", List.of());
    Column amount = column("amount", List.of());
    Table table = table(List.of(), id, amount);

    AssetLabelEdits.add(table, Entity.TABLE, TABLE_FQN + ".amount", label(LabelType.MANUAL));

    assertTrue(table.getTags().isEmpty());
    assertTrue(id.getTags().isEmpty());
    assertEquals(List.of(TAG_FQN), fqns(amount.getTags()));
  }

  @Test
  void addNextToADerivedCopyAddsTheAssetsOwnCopy() {
    Table table = table(mutable(label(LabelType.DERIVED)), column("id", List.of()));

    AssetLabelEdits.add(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertEquals(2, table.getTags().size());
    assertEquals(LabelType.MANUAL, table.getTags().get(1).getLabelType());
  }

  @Test
  void stripRemovesTheLabelFromTheAssetAndItsNestedColumns() {
    Column nested = column("street", mutable(label(LabelType.MANUAL)));
    Column address =
        column("address", mutable(label(LabelType.MANUAL))).withChildren(List.of(nested));
    Table table = table(mutable(label(LabelType.MANUAL)), address);

    AssetLabelEdits.strip(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertTrue(table.getTags().isEmpty());
    assertTrue(address.getTags().isEmpty());
    assertTrue(nested.getTags().isEmpty());
  }

  @Test
  void stripLeavesDerivedLabelsAlone() {
    Column id = column("id", mutable(label(LabelType.DERIVED)));
    Table table = table(mutable(label(LabelType.DERIVED), label(LabelType.MANUAL)), id);

    AssetLabelEdits.strip(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertEquals(List.of(LabelType.DERIVED), labelTypes(table.getTags()));
    assertEquals(List.of(LabelType.DERIVED), labelTypes(id.getTags()));
  }

  @Test
  void stripOnlyRemovesTheSelectedSource() {
    TagLabel glossaryTerm = label(LabelType.MANUAL).withSource(TagSource.GLOSSARY);
    Table table = table(mutable(glossaryTerm, label(LabelType.MANUAL)), column("id", null));

    AssetLabelEdits.strip(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertEquals(
        List.of(TagSource.GLOSSARY), table.getTags().stream().map(TagLabel::getSource).toList());
  }

  @Test
  void stripOfAColumnStaysInsideThatColumnsSubtree() {
    Column nested = column("street", mutable(label(LabelType.MANUAL)));
    Column address =
        column("address", mutable(label(LabelType.MANUAL))).withChildren(List.of(nested));
    Column id = column("id", mutable(label(LabelType.MANUAL)));
    Table table = table(mutable(label(LabelType.MANUAL)), address, id);

    AssetLabelEdits.strip(table, Entity.TABLE, TABLE_FQN + ".address", label(LabelType.MANUAL));

    assertTrue(address.getTags().isEmpty());
    assertTrue(nested.getTags().isEmpty());
    assertEquals(List.of(TAG_FQN), fqns(id.getTags()));
    assertEquals(List.of(TAG_FQN), fqns(table.getTags()));
  }

  @Test
  void aMissingColumnIsANoOp() {
    Column id = column("id", mutable(label(LabelType.MANUAL)));
    Table table = table(mutable(label(LabelType.MANUAL)), id);

    AssetLabelEdits.add(table, Entity.TABLE, TABLE_FQN + ".missing", label(LabelType.MANUAL));
    AssetLabelEdits.strip(table, Entity.TABLE, TABLE_FQN + ".missing", label(LabelType.MANUAL));

    assertEquals(List.of(TAG_FQN), fqns(table.getTags()));
    assertEquals(List.of(TAG_FQN), fqns(id.getTags()));
  }

  @Test
  void stripLeavesAnUntaggedFieldsNullTags() {
    Column id = column("id", null);
    Table table = table(mutable(label(LabelType.MANUAL)), id);

    AssetLabelEdits.strip(table, Entity.TABLE, null, label(LabelType.MANUAL));

    assertNull(id.getTags());
  }

  @Test
  void stripReachesSchemaFieldsOfOtherChildContainerTypes() {
    Field field = new Field().withName("customer").withTags(mutable(label(LabelType.MANUAL)));
    Topic topic =
        new Topic()
            .withFullyQualifiedName("kafka.orders")
            .withTags(new ArrayList<>())
            .withMessageSchema(new MessageSchema().withSchemaFields(List.of(field)));

    AssetLabelEdits.strip(topic, Entity.TOPIC, null, label(LabelType.MANUAL));

    assertTrue(field.getTags().isEmpty());
  }

  @Test
  void anAssetWithoutChildFieldsOnlyLosesItsOwnLabel() {
    DatabaseSchema schema =
        new DatabaseSchema()
            .withFullyQualifiedName("svc.db.schema")
            .withTags(mutable(label(LabelType.MANUAL)));

    AssetLabelEdits.strip(schema, Entity.DATABASE_SCHEMA, null, label(LabelType.MANUAL));

    assertTrue(schema.getTags().isEmpty());
  }

  private static Table table(List<TagLabel> tags, Column... columns) {
    return new Table()
        .withFullyQualifiedName(TABLE_FQN)
        .withTags(tags == null ? null : new ArrayList<>(tags))
        .withColumns(List.of(columns));
  }

  private static Column column(String name, List<TagLabel> tags) {
    return new Column()
        .withName(name)
        .withFullyQualifiedName(TABLE_FQN + "." + name)
        .withTags(tags);
  }

  private static TagLabel label(LabelType labelType) {
    return new TagLabel()
        .withTagFQN(TAG_FQN)
        .withSource(TagSource.CLASSIFICATION)
        .withLabelType(labelType)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<TagLabel> mutable(TagLabel... labels) {
    return new ArrayList<>(List.of(labels));
  }

  private static List<String> fqns(List<TagLabel> labels) {
    return labels.stream().map(TagLabel::getTagFQN).toList();
  }

  private static List<LabelType> labelTypes(List<TagLabel> labels) {
    return labels.stream().map(TagLabel::getLabelType).toList();
  }
}
