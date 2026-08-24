package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;

/**
 * The array-mode semantics. These are the behaviours where getting it wrong loses a caller's data
 * silently rather than failing, so they are pinned rather than left to the merge helpers' shape.
 */
class UpdateEntityMergeTest {

  private static Table tableWith(String description, String... tagFqns) {
    Table table = new Table().withName("dim_address").withDescription(description);
    table.setTags(List.of(tagFqns).stream().map(fqn -> new TagLabel().withTagFQN(fqn)).toList());
    return table;
  }

  private static List<String> tagFqnsOf(Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).toList();
  }

  private static void apply(Table table, Map<String, Object> params) {
    new UpdateEntityTool().applyChangesForTest(table, params);
  }

  @Test
  void tagsSetReplacesTheWholeList() {
    Table table = tableWith("d", "PII.Sensitive", "Tier.Tier1");

    apply(table, Map.of("tags", List.of("Tier.Tier2"), "tagsMode", "set"));

    assertEquals(List.of("Tier.Tier2"), tagFqnsOf(table), "'set' is a replace, as documented");
  }

  @Test
  void tagsAddMergesWithoutDuplicating() {
    Table table = tableWith("d", "PII.Sensitive", "Tier.Tier1");

    apply(table, Map.of("tags", List.of("Tier.Tier1", "Certification.Gold"), "tagsMode", "add"));

    assertEquals(
        List.of("PII.Sensitive", "Tier.Tier1", "Certification.Gold"),
        tagFqnsOf(table),
        "'add' keeps existing tags, appends new ones, and does not re-add one already present");
  }

  @Test
  void tagsRemoveSubtractsAndLeavesTheRest() {
    Table table = tableWith("d", "PII.Sensitive", "Tier.Tier1");

    apply(table, Map.of("tags", List.of("PII.Sensitive"), "tagsMode", "remove"));

    assertEquals(List.of("Tier.Tier1"), tagFqnsOf(table));
  }

  @Test
  void tagsDefaultToSetWhenNoModeIsGiven() {
    Table table = tableWith("d", "PII.Sensitive");

    apply(table, Map.of("tags", List.of("Tier.Tier1")));

    assertEquals(
        List.of("Tier.Tier1"),
        tagFqnsOf(table),
        "the default must match what the schema documents, or callers lose tags they never named");
  }

  @Test
  void descriptionAppendKeepsTheExistingText() {
    Table table = tableWith("Curated description that took someone real effort.");

    apply(table, Map.of("description", "Also mentions Churn Rate.", "descriptionMode", "append"));

    assertTrue(
        table.getDescription().startsWith("Curated description that took someone real effort."),
        "append must not clobber - that is the whole reason the mode exists: "
            + table.getDescription());
    assertTrue(table.getDescription().endsWith("Also mentions Churn Rate."));
  }

  @Test
  void descriptionAppendOnAnEmptyFieldJustSetsIt() {
    Table table = tableWith(null);

    apply(table, Map.of("description", "First description.", "descriptionMode", "append"));

    assertEquals(
        "First description.",
        table.getDescription(),
        "appending to nothing must not leave leading blank lines");
  }

  @Test
  void anUntouchedFieldStaysUntouched() {
    Table table = tableWith("original", "PII.Sensitive");

    apply(table, Map.of("displayName", "Address Dimension"));

    assertEquals("original", table.getDescription(), "a field not named is never modified");
    assertEquals(List.of("PII.Sensitive"), tagFqnsOf(table));
    assertEquals("Address Dimension", table.getDisplayName());
  }
}
