package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
class TypedFieldPatchMergeTest {

  private static Table tableWith(String description, String... tagFqns) {
    Table table = new Table().withName("dim_address").withDescription(description);
    table.setTags(List.of(tagFqns).stream().map(fqn -> new TagLabel().withTagFQN(fqn)).toList());
    return table;
  }

  private static List<String> tagFqnsOf(Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).toList();
  }

  private static void apply(Table table, Map<String, Object> params) {
    TypedFieldPatch.applyChanges(table, params);
  }

  @Test
  void tagsSetIsStillAReplaceWhenItIsAskedForByName() {
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
  void tagsDefaultToAddSoTierAndGlossaryTermsSurvive() {
    Table table = tableWith("d", "PII.Sensitive", "Tier.Tier1", "Finance.Revenue");

    apply(table, Map.of("tags", List.of("PII.Confidential")));

    assertEquals(
        List.of("PII.Sensitive", "Tier.Tier1", "Finance.Revenue", "PII.Confidential"),
        tagFqnsOf(table),
        "adding one tag must not delete the tier or the glossary terms: they live in the same tags "
            + "array, this tool cannot restate a glossary term at all, and a 'set' default made "
            + "tags:['PII.Sensitive'] - the ordinary way to add a tag - destroy both and report "
            + "success");
  }

  @Test
  void anUnrecognisedArrayModeIsRejectedRatherThanTreatedAsAReplace() {
    Table table = tableWith("d", "PII.Sensitive", "Tier.Tier1");

    IllegalArgumentException rejected =
        assertThrows(
            IllegalArgumentException.class,
            () -> apply(table, Map.of("tags", List.of("Finance.Revenue"), "tagsMode", "append")),
            "the merge helpers start from the requested list and only deviate for add/remove, so "
                + "an unrecognised mode silently meant replace - and 'append' is the natural wrong "
                + "guess, because descriptionMode uses it while arrays use 'add'");

    assertTrue(rejected.getMessage().contains("tagsMode"), "the error names the parameter");
    assertEquals(List.of("PII.Sensitive", "Tier.Tier1"), tagFqnsOf(table), "nothing was written");
  }

  @Test
  void anUnrecognisedDescriptionModeIsRejected() {
    Table table = tableWith("Curated text worth keeping.");

    assertThrows(
        IllegalArgumentException.class,
        () -> apply(table, Map.of("description", "A note.", "descriptionMode", "appended")),
        "a near-miss on 'append' must not silently overwrite curated text");
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
