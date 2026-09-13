package org.openmetadata.service.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.EntityUtil.Fields;

class EntityFieldPolicyTest {
  @Test
  void excludedSelectionsIgnoreUnknownNamesAndNormalizeSpaces() {
    final var policy = new EntityFieldPolicy(Set.of("displayName", "owners", "description"));
    assertEquals(
        Set.of("description"), policy.excluding("owners, dis playName, unknown,").getFieldList());
    assertEquals(policy.allowedCopy(), policy.excluding(null).getFieldList());
    assertEquals(policy.allowedCopy(), policy.excluding("*").getFieldList());
  }

  @Test
  void excludedSelectionsRemainIndependentOfLaterSchemaChanges() {
    final Set<String> allowed = new HashSet<>(Set.of("id", "owners"));
    final var policy = new EntityFieldPolicy(allowed);
    final Fields before = policy.excluding("owners");
    allowed.add("payload");
    final Fields after = policy.excluding("owners");
    assertEquals(Set.of("id"), before.getFieldList());
    assertEquals(Set.of("id", "payload"), after.getFieldList());
    before.getFieldList().clear();
    assertEquals(Set.of("id", "payload"), after.getFieldList());
    assertEquals(Set.of("id", "owners", "payload"), allowed);
  }

  @Test
  void strictAndSupportedSelectionsKeepTheirDifferentParsingContracts() {
    var policy = new EntityFieldPolicy(Set.of("displayName", "owners"));

    assertEquals(Set.of("displayName"), policy.parse("display Name").getFieldList());
    assertThrows(IllegalArgumentException.class, () -> policy.parse("unknown"));
    assertEquals(Set.of("owners"), policy.supported(" owners, unknown, ").getFieldList());
    assertTrue(policy.supported("display Name").getFieldList().isEmpty());
    assertTrue(policy.parse((String) null).getFieldList().isEmpty());
    assertTrue(policy.supported(null).getFieldList().isEmpty());
  }

  @Test
  void wildcardSelectionsAreIndependentAndSeeFieldsAddedByAnEntityModule() {
    Set<String> allowed = new HashSet<>(Set.of("id", "description"));
    var policy = new EntityFieldPolicy(allowed);
    Fields before = policy.parse("*");
    allowed.add("payload");
    Fields after = policy.parse("*");
    Fields supported = policy.supported("*");
    after.getFieldList().remove("id");
    supported.getFieldList().clear();

    assertEquals(Set.of("id", "description"), before.getFieldList());
    assertEquals(Set.of("id", "description", "payload"), policy.parse("*").getFieldList());
    assertEquals(Set.of("description", "payload"), after.getFieldList());
    assertEquals(Set.of("id", "description", "payload"), allowed);
  }

  @Test
  void setsAreValidatedAndCopied() {
    Set<String> allowed = new HashSet<>(Set.of("id", "owners"));
    Set<String> requested = new HashSet<>(Set.of("owners"));
    var policy = new EntityFieldPolicy(allowed);
    Fields fields = policy.parse(requested);
    requested.clear();
    policy.allowedCopy().clear();

    assertEquals(Set.of("owners"), fields.getFieldList());
    assertEquals(Set.of("id", "owners"), allowed);
    assertTrue(policy.parse((Set<String>) null).getFieldList().isEmpty());
    assertThrows(IllegalArgumentException.class, () -> policy.parse(Set.of("unknown")));
  }

  @Test
  void commonWriteFieldsExtendBothSelectionsOnlyWhenSupported() {
    var common =
        Set.of(
            "tags",
            "owners",
            "followers",
            "extension",
            "votes",
            "domains",
            "reviewers",
            "experts",
            "dataProducts",
            "style",
            "lifeCycle",
            "certification",
            "entityStatus");
    Set<String> allowed = new HashSet<>(common);
    allowed.addAll(List.of("id", "name", "deleted", "dataContract", "children"));
    var policy = new EntityFieldPolicy(allowed);
    Fields patch = policy.parse("id");
    Fields put = policy.parse("name");
    policy.addCommonWriteFields(patch, put);

    assertTrue(patch.getFieldList().containsAll(common));
    assertTrue(put.getFieldList().containsAll(common));
    assertEquals(common.size() + 1, patch.getFieldList().size());
    assertEquals(common.size() + 1, put.getFieldList().size());
    assertFalse(patch.contains("name"));
    assertFalse(put.contains("id"));

    var limited = new EntityFieldPolicy(Set.of("owners"));
    Fields limitedPatch = limited.parse("");
    Fields limitedPut = limited.parse("");
    limited.addCommonWriteFields(limitedPatch, limitedPut);
    assertEquals(Set.of("owners"), limitedPatch.getFieldList());
    assertEquals(Set.of("owners"), limitedPut.getFieldList());
  }

  @Test
  void summariesIncludeSupportedDescriptionAndOwnersWithoutChangingConfiguration() {
    Set<String> configured = new HashSet<>(Set.of("custom"));
    var policy = new EntityFieldPolicy(Set.of("description", "owners"));

    assertEquals(Set.of("custom", "description", "owners"), policy.summaryFields(configured));
    assertEquals(Set.of("custom"), configured);
    assertEquals(Set.of("custom"), new EntityFieldPolicy(Set.of()).summaryFields(configured));
  }
}
