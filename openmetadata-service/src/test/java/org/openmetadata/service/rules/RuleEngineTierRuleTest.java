package org.openmetadata.service.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Guards the server-side evaluation of a workflow "Tier" condition against the raw serialized
 * entity, the context {@link RuleEngine#apply(String, Map)} (via {@link CheckEntityAttributesImpl}
 * and {@code TriggerEntityFilter.excludes}) actually evaluates against.
 *
 * <p>The governance-workflow query builder exports a Tier rule against the entity's {@code tags}
 * list (a {@code Tier.*} entry), since a serialized entity has no {@code tier} property. A rule
 * keyed on {@code {"var":"tier"}} resolves to {@code null} and silently never matches — see
 * {@code jsonLogicTierVar.ts} on the UI side.
 */
class RuleEngineTierRuleTest {

  private static TagLabel tag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static Map<String, Object> entityMap(Table table) {
    return JsonUtils.getMap(table);
  }

  // The wire shape the workflow query builder now exports after the fix.
  private static final String TIER_CONTAINS_TIER1 =
      "{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}";
  private static final String TIER_NOT_CONTAINS_TIER1 =
      "{\"!\":{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}}";

  // The broken shape the bug introduced (exported from 0bd108b until this fix): the variable points
  // at a non-existent `tier` property, so it must resolve to null/false for any entity.
  private static final String BROKEN_TIER_VAR_CONTAINS_TIER1 =
      "{\"some\":[{\"var\":\"tier\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}";

  @Test
  void tierContainsRuleMatchesTableTaggedTier1() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));

    assertEquals(true, RuleEngine.getInstance().apply(TIER_CONTAINS_TIER1, entityMap(table)));
  }

  @Test
  void tierContainsRuleDoesNotMatchTableWithoutTierTag() {
    Table table = new Table().withId(UUID.randomUUID()).withName("no_tier");

    assertEquals(false, RuleEngine.getInstance().apply(TIER_CONTAINS_TIER1, entityMap(table)));
  }

  @Test
  void tierContainsRuleDoesNotMatchTableTaggedTier2() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("other_tier")
            .withTags(List.of(tag("Tier.Tier2")));

    assertEquals(false, RuleEngine.getInstance().apply(TIER_CONTAINS_TIER1, entityMap(table)));
  }

  @Test
  void tierNotContainsRuleInversesTheMatch() {
    Table withTier =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));
    Table withoutTier = new Table().withId(UUID.randomUUID()).withName("no_tier");

    assertEquals(
        false, RuleEngine.getInstance().apply(TIER_NOT_CONTAINS_TIER1, entityMap(withTier)));
    assertEquals(
        true, RuleEngine.getInstance().apply(TIER_NOT_CONTAINS_TIER1, entityMap(withoutTier)));
  }

  @Test
  void brokenTierVarRuleNeverMatchesEvenWhenEntityCarriesTier1() {
    // Proves the bug: the variable the buggy UI emitted (`tier`) is not a property of any
    // serialized entity, so the rule resolves to false even for a Tier.Tier1-tagged table.
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));

    assertEquals(
        false, RuleEngine.getInstance().apply(BROKEN_TIER_VAR_CONTAINS_TIER1, entityMap(table)));
  }
}
