package org.openmetadata.service.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Guards the server-side evaluation of a workflow "Tier" condition against the raw serialized
 * entity, the context {@link RuleEngine#apply(String, Map)} (via {@link CheckEntityAttributesImpl}
 * and {@code TriggerEntityFilter.excludes}) actually evaluates against.
 *
 * <p>The governance-workflow query builder exports a Tier rule against the entity's {@code tags}
 * list (a {@code Tier.*} entry), since a serialized entity has no {@code tier} property. A rule
 * keyed on {@code {"var":"tier"}} (the shape saved before the fix) is rewritten to {@code tags} by
 * {@link RuleEngine} so already-stored rules keep working — see {@code jsonLogicTierVar.ts} on the
 * UI side.
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

  // The shape the Tier field saved before the fix. Rules already stored this way must keep working
  // after upgrade, so RuleEngine rewrites `tier` to `tags` at evaluation time.
  private static final String LEGACY_TIER_VAR_CONTAINS_TIER1 =
      "{\"some\":[{\"var\":\"tier\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}";
  private static final String LEGACY_TIER_VAR_NOT_CONTAINS_TIER1 =
      "{\"!\":{\"some\":[{\"var\":\"tier\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}}";

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
  void legacyTierVarRuleMatchesOnlyEntitiesTaggedTier1() {
    Table tier1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));
    Table tier2 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("other_tier")
            .withTags(List.of(tag("Tier.Tier2")));
    Table untagged = new Table().withId(UUID.randomUUID()).withName("no_tier");

    assertEquals(
        true, RuleEngine.getInstance().apply(LEGACY_TIER_VAR_CONTAINS_TIER1, entityMap(tier1)));
    assertEquals(
        false, RuleEngine.getInstance().apply(LEGACY_TIER_VAR_CONTAINS_TIER1, entityMap(tier2)));
    assertEquals(
        false, RuleEngine.getInstance().apply(LEGACY_TIER_VAR_CONTAINS_TIER1, entityMap(untagged)));
  }

  @Test
  void legacyTierVarNotContainsRuleInversesTheMatch() {
    Table withTier =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));
    Table withoutTier = new Table().withId(UUID.randomUUID()).withName("no_tier");

    assertEquals(
        false,
        RuleEngine.getInstance().apply(LEGACY_TIER_VAR_NOT_CONTAINS_TIER1, entityMap(withTier)));
    assertEquals(
        true,
        RuleEngine.getInstance().apply(LEGACY_TIER_VAR_NOT_CONTAINS_TIER1, entityMap(withoutTier)));
  }

  @Test
  void legacyTierVarDataAssetRuleIsEvaluatedAgainstTags() {
    SemanticsRule rule =
        new SemanticsRule()
            .withName("Tier1 only")
            .withDescription("Legacy Tier rule")
            .withRule(LEGACY_TIER_VAR_CONTAINS_TIER1)
            .withEnabled(true);
    Table tier1 =
        new Table()
            .withId(UUID.randomUUID())
            .withName("has_tier")
            .withTags(List.of(tag("Tier.Tier1")));
    Table untagged = new Table().withId(UUID.randomUUID()).withName("no_tier");

    assertTrue(
        RuleEngine.getInstance().evaluateAndReturn(tier1, List.of(rule), false, false).isEmpty());
    assertEquals(
        List.of(rule),
        RuleEngine.getInstance().evaluateAndReturn(untagged, List.of(rule), false, false));
  }
}
