package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.service.util.ParallelizeTest;

@ParallelizeTest
class PolicyEvaluatorTest {
  @Test
  public void test_AccessOrderOfPrecedence() {
    //
    // Order of precedence for access Deny > Allow > ConditionalDeny > ConditionalAllow > NotAllow
    //

    // newAccess (Deny|Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Deny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.DENY));

    // newAccess (Deny) and currentAccess Allow - newAccess Deny takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.ALLOW));

    // newAccess (Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Allow takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.ALLOW));

    // newAccess (Deny|Allow) and currentAccess ConditionalDeny - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_DENY));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (ConditionDeny|ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (Deny|Allow|ConditionalDeny) and currentAccess ConditionalAllow - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_ALLOW));

    // newAccess (ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_ALLOW));

    // newAccess (Deny|Allow|ConditionalDeny|ConditionalAllow) and currentAccess notAllow - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.NOT_ALLOW));

    // newAccess (ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.NOT_ALLOW));
  }
}
