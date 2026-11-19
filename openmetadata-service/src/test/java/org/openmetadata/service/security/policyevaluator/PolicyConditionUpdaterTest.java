/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.ROLE_FUNCTIONS;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.SERVICE_FUNCTIONS;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.TAG_FUNCTIONS;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.TEAM_FUNCTIONS;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.FunctionCall;

class PolicyConditionUpdaterTest {

  /** Entity names may contain parentheses, commas and apostrophes. */
  private static final String NAME_WITH_PUNCTUATION = "Cls.Retail (EU), Men's Wear";

  private static final String QUOTED_NAME_WITH_PUNCTUATION = "'Cls.Retail (EU), Men''s Wear'";

  // ===================================================================
  // RENAME TESTS
  // ===================================================================

  @Test
  void renameInCondition_singleTagArg() {
    String result =
        PolicyConditionUpdater.renameInCondition("matchAnyTag('A.B')", "A.B", "A.C", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('A.C')", result);
  }

  @Test
  void renameInCondition_multipleTagArgs() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAnyTag('A.B', 'D.E')", "A.B", "A.C", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('A.C', 'D.E')", result);
  }

  @Test
  void renameInCondition_tagWithCompoundCondition() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAnyTag('A.B') && hasAnyRole('R1')", "A.B", "X.Y", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('X.Y') && hasAnyRole('R1')", result);
  }

  @Test
  void renameInCondition_exactMatchOnly() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAnyTag('A.B.C')", "A.B", "A.X", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('A.B.C')", result);
  }

  @Test
  void renameInCondition_role() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "hasAnyRole('DataSteward')", "DataSteward", "DataCurator", ROLE_FUNCTIONS);
    assertEquals("hasAnyRole('DataCurator')", result);
  }

  @Test
  void renameInCondition_team() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "inAnyTeam('marketing')", "marketing", "growth", TEAM_FUNCTIONS);
    assertEquals("inAnyTeam('growth')", result);
  }

  @Test
  void renameInCondition_nullCondition() {
    String result = PolicyConditionUpdater.renameInCondition(null, "A.B", "A.C", TAG_FUNCTIONS);
    assertNull(result);
  }

  @Test
  void renameInCondition_noMatchingFunction() {
    String result =
        PolicyConditionUpdater.renameInCondition("isOwner()", "A.B", "A.C", TAG_FUNCTIONS);
    assertEquals("isOwner()", result);
  }

  @Test
  void renameInCondition_matchAllTags() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAllTags('A.B', 'C.D')", "C.D", "C.E", TAG_FUNCTIONS);
    assertEquals("matchAllTags('A.B', 'C.E')", result);
  }

  @Test
  void renameInCondition_matchAnyCertification() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAnyCertification('Cert.Gold')", "Cert.Gold", "Cert.Platinum", TAG_FUNCTIONS);
    assertEquals("matchAnyCertification('Cert.Platinum')", result);
  }

  @Test
  void renameInCondition_multipleTagFunctionsInSameCondition() {
    String result =
        PolicyConditionUpdater.renameInCondition(
            "matchAnyTag('A.B') && matchAllTags('A.B', 'C.D')", "A.B", "A.X", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('A.X') && matchAllTags('A.X', 'C.D')", result);
  }

  // ===================================================================
  // PREFIX RENAME TESTS (classification/glossary renames)
  // ===================================================================

  @Test
  void renamePrefixInCondition_classificationRename() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('PersonalData.Personal')", "PersonalData", "PD", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('PD.Personal')", result);
  }

  @Test
  void renamePrefixInCondition_glossaryRename() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('Business Glossary.Clothing')",
            "Business Glossary",
            "BizGlossary",
            TAG_FUNCTIONS);
    assertEquals("matchAnyTag('BizGlossary.Clothing')", result);
  }

  @Test
  void renamePrefixInCondition_exactMatchAlsoRenames() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('A.B')", "A.B", "X.Y", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('X.Y')", result);
  }

  @Test
  void renamePrefixInCondition_noMatchingPrefix() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('Other.Tag')", "PersonalData", "PD", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('Other.Tag')", result);
  }

  @Test
  void renamePrefixInCondition_multipleChildTags() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('PII.Name', 'PII.Email')", "PII", "Personal", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('Personal.Name', 'Personal.Email')", result);
  }

  @Test
  void renamePrefixInCondition_nestedChildTag() {
    String result =
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyTag('A.B.C')", "A.B", "X.Y", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('X.Y.C')", result);
  }

  // ===================================================================
  // PREFIX DELETE TESTS (classification/glossary deletion)
  // ===================================================================

  @Test
  void removeByPrefixFromCondition_removesAllChildTags() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('PII.Name', 'PII.Email', 'Tier.Tier1')", "PII", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('Tier.Tier1')", result);
  }

  @Test
  void removeByPrefixFromCondition_removesAllWhenAllMatch() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('PII.Name', 'PII.Email')", "PII", TAG_FUNCTIONS);
    assertEquals("false", result);
  }

  @Test
  void removeByPrefixFromCondition_exactPrefixMatch() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('PII')", "PII", TAG_FUNCTIONS);
    assertEquals("false", result);
  }

  @Test
  void removeByPrefixFromCondition_noMatchingPrefix() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('Tier.Tier1')", "PII", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('Tier.Tier1')", result);
  }

  @Test
  void removeByPrefixFromCondition_withCompoundCondition() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('PII.Name') && hasAnyRole('Admin')", "PII", TAG_FUNCTIONS);
    assertEquals("false && hasAnyRole('Admin')", result);
  }

  // ===================================================================
  // DELETE TESTS
  // ===================================================================

  @Test
  void removeFromCondition_removeOneOfTwoArgs() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyTag('A.B', 'D.E')", "A.B", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('D.E')", result);
  }

  @Test
  void removeFromCondition_removeOnlyArg() {
    String result =
        PolicyConditionUpdater.removeFromCondition("matchAnyTag('A.B')", "A.B", TAG_FUNCTIONS);
    assertEquals("false", result);
  }

  @Test
  void removeFromCondition_tagWithAndCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyTag('A.B') && hasAnyRole('R1')", "A.B", TAG_FUNCTIONS);
    assertEquals("false && hasAnyRole('R1')", result);
  }

  @Test
  void removeFromCondition_roleOneOfTwoArgs() {
    String result =
        PolicyConditionUpdater.removeFromCondition("hasAnyRole('R1', 'R2')", "R1", ROLE_FUNCTIONS);
    assertEquals("hasAnyRole('R2')", result);
  }

  @Test
  void removeFromCondition_roleOnlyArg() {
    String result =
        PolicyConditionUpdater.removeFromCondition("hasAnyRole('R1')", "R1", ROLE_FUNCTIONS);
    assertEquals("false", result);
  }

  @Test
  void removeFromCondition_teamWithOrCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "inAnyTeam('marketing') || hasAnyRole('R1')", "marketing", TEAM_FUNCTIONS);
    assertEquals("false || hasAnyRole('R1')", result);
  }

  @Test
  void removeFromCondition_middleFunctionInCompoundCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "hasAnyRole('R1') && matchAnyTag('A') && inAnyTeam('T1')", "A", TAG_FUNCTIONS);
    assertEquals("hasAnyRole('R1') && false && inAnyTeam('T1')", result);
  }

  @Test
  void removeFromCondition_multipleTagFunctions() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "matchAllTags('A', 'B') && matchAnyTag('A')", "A", TAG_FUNCTIONS);
    assertEquals("false && false", result);
  }

  @Test
  void removeFromCondition_nullCondition() {
    String result = PolicyConditionUpdater.removeFromCondition(null, "A.B", TAG_FUNCTIONS);
    assertNull(result);
  }

  @Test
  void removeFromCondition_noMatchingArg() {
    String result =
        PolicyConditionUpdater.removeFromCondition("matchAnyTag('A.B')", "X.Y", TAG_FUNCTIONS);
    assertEquals("matchAnyTag('A.B')", result);
  }

  // ===================================================================
  // SERVICE CONDITION TESTS
  // ===================================================================

  /**
   * matchAnyServiceTag takes a tag FQN, so a classification or tag rename has to rewrite it — a
   * condition left pointing at the old FQN resolves to no service, and the Deny rule that was
   * hiding a service's assets silently starts granting access.
   */
  @Test
  void renameInCondition_serviceTagIsRewrittenWithTheOtherTagFunctions() {
    assertEquals(
        "matchAnyServiceTag('Environment.Dev')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyServiceTag('Env.Dev')", "Env.Dev", "Environment.Dev", TAG_FUNCTIONS));
  }

  @Test
  void renamePrefixInCondition_serviceTagFollowsAClassificationRename() {
    assertEquals(
        "matchAnyServiceTag('Environment.Development') && isOwner()",
        PolicyConditionUpdater.renamePrefixInCondition(
            "matchAnyServiceTag('Env.Development') && isOwner()",
            "Env",
            "Environment",
            TAG_FUNCTIONS));
  }

  @Test
  void removeFromCondition_serviceTagIsDroppedWhenTheTagIsDeleted() {
    assertEquals(
        "matchAnyServiceTag('Environment.Staging')",
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyServiceTag('Environment.Development', 'Environment.Staging')",
            "Environment.Development",
            TAG_FUNCTIONS));
  }

  /** A service rename must follow the condition, for the same fail-open reason. */
  @Test
  void renameInCondition_serviceName() {
    assertEquals(
        "matchAnyServiceName('snowflake-production')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyServiceName('snowflake-prod')",
            "snowflake-prod",
            "snowflake-production",
            SERVICE_FUNCTIONS));
  }

  /** A tag rename must not reach into a service-name argument, or vice versa. */
  @Test
  void renameInCondition_serviceFunctionsAreScopedToTheirOwnArguments() {
    String condition = "matchAnyServiceName('prod') && matchAnyServiceTag('prod')";

    assertEquals(
        "matchAnyServiceName('prod') && matchAnyServiceTag('staging')",
        PolicyConditionUpdater.renameInCondition(condition, "prod", "staging", TAG_FUNCTIONS));
    assertEquals(
        "matchAnyServiceName('staging') && matchAnyServiceTag('prod')",
        PolicyConditionUpdater.renameInCondition(condition, "prod", "staging", SERVICE_FUNCTIONS));
  }

  // ===================================================================
  // SpEL ESCAPED-APOSTROPHE TESTS
  // ===================================================================

  /**
   * SpEL writes an apostrophe inside a string literal as {@code ''}. Read as two arguments it would
   * rewrite into names that exist nowhere, disarming the rule — so the escape has to survive a
   * round trip.
   */
  @Test
  void findCalls_readsAnEscapedApostropheAsOneArgument() {
    assertEquals(
        List.of("bob's-db"),
        onlyCall("matchAnyServiceName('bob''s-db')", SERVICE_FUNCTIONS).args());
  }

  @Test
  void findCalls_keepsEscapedAndPlainArgumentsApart() {
    assertEquals(
        List.of("bob's-db", "plain"),
        onlyCall("matchAnyServiceName('bob''s-db', 'plain')", SERVICE_FUNCTIONS).args());
  }

  @Test
  void renameInCondition_renamesAServiceWhoseNameHasAnApostrophe() {
    assertEquals(
        "matchAnyServiceName('renamed')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyServiceName('bob''s-db')", "bob's-db", "renamed", SERVICE_FUNCTIONS));
  }

  /** The new name has to be re-escaped, or the rewritten condition no longer parses as SpEL. */
  @Test
  void renameInCondition_reEscapesAnApostropheInTheNewName() {
    assertEquals(
        "matchAnyServiceName('bob''s-db')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyServiceName('plain')", "plain", "bob's-db", SERVICE_FUNCTIONS));
  }

  @Test
  void renameInCondition_leavesAnUnrelatedEscapedArgumentIntact() {
    assertEquals(
        "matchAnyServiceName('bob''s-db', 'renamed')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyServiceName('bob''s-db', 'plain')", "plain", "renamed", SERVICE_FUNCTIONS));
  }

  @Test
  void removeFromCondition_removesAnEscapedArgumentAndKeepsTheRest() {
    assertEquals(
        "matchAnyServiceName('plain')",
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyServiceName('bob''s-db', 'plain')", "bob's-db", SERVICE_FUNCTIONS));
  }

  @Test
  void removeFromCondition_keepsAnEscapedArgumentWhenAnotherIsRemoved() {
    assertEquals(
        "matchAnyServiceName('bob''s-db')",
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyServiceName('bob''s-db', 'plain')", "plain", SERVICE_FUNCTIONS));
  }

  /** A hard delete of the only referenced service leaves a call that matches nothing. */
  @Test
  void removeFromCondition_neverMatchesWhenTheEscapedNameWasTheOnlyArgument() {
    assertEquals(
        "false",
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyServiceName('bob''s-db')", "bob's-db", SERVICE_FUNCTIONS));
  }

  /** Tag FQNs carry the same hazard — a glossary term such as {@code Men's Wear}. */
  @Test
  void renameInCondition_renamesATagFqnContainingAnApostrophe() {
    assertEquals(
        "matchAnyTag('Glossary.Menswear')",
        PolicyConditionUpdater.renameInCondition(
            "matchAnyTag('Glossary.Men''s Wear')",
            "Glossary.Men's Wear",
            "Glossary.Menswear",
            TAG_FUNCTIONS));
  }

  // ===================================================================
  // NAMES WITH PUNCTUATION
  // ===================================================================

  /** A name with punctuation stays one argument through every later rewrite of the condition. */
  @Test
  void renameInCondition_keepsANameWithPunctuationAsOneArgumentAcrossLaterRewrites() {
    String renamed =
        PolicyConditionUpdater.renameInCondition(
            "!matchAnyTag('Cls.Restricted')",
            "Cls.Restricted",
            NAME_WITH_PUNCTUATION,
            TAG_FUNCTIONS);
    assertEquals("!matchAnyTag(" + QUOTED_NAME_WITH_PUNCTUATION + ")", renamed);

    assertEquals(
        renamed,
        PolicyConditionUpdater.renameInCondition(
            renamed, "Other.Tag", "Other.Renamed", TAG_FUNCTIONS));
    assertEquals(
        renamed, PolicyConditionUpdater.removeFromCondition(renamed, "Other.Tag", TAG_FUNCTIONS));
    assertEquals(List.of(NAME_WITH_PUNCTUATION), onlyCall(renamed, TAG_FUNCTIONS).args());
  }

  @Test
  void renameInCondition_renamesANameWithPunctuation() {
    assertEquals(
        "!matchAnyTag('Cls.Restricted')",
        PolicyConditionUpdater.renameInCondition(
            "!matchAnyTag(" + QUOTED_NAME_WITH_PUNCTUATION + ")",
            NAME_WITH_PUNCTUATION,
            "Cls.Restricted",
            TAG_FUNCTIONS));
  }

  @Test
  void removeFromCondition_keepsANameWithPunctuationWhenAnotherArgumentIsRemoved() {
    assertEquals(
        "matchAnyTag(" + QUOTED_NAME_WITH_PUNCTUATION + ")",
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyTag(" + QUOTED_NAME_WITH_PUNCTUATION + ", 'Cls.Other')",
            "Cls.Other",
            TAG_FUNCTIONS));
  }

  /** Every policy is rewritten on any rename, so an untouched call must come back byte for byte. */
  @Test
  void renameInCondition_leavesACallWithoutTheRenamedArgumentAsWritten() {
    String condition = "hasAnyRole( 'R1' ,'R2' ) && isOwner()";
    assertEquals(
        condition, PolicyConditionUpdater.renameInCondition(condition, "R3", "R4", ROLE_FUNCTIONS));
  }

  @Test
  void findCalls_spansTheWholeCallIncludingItsParentheses() {
    String condition = "isOwner() && hasAnyRole( 'R1' , 'R2' )";
    FunctionCall call = onlyCall(condition, ROLE_FUNCTIONS);
    assertEquals("hasAnyRole( 'R1' , 'R2' )", condition.substring(call.start(), call.end()));
  }

  @Test
  void removeFromCondition_leavesAnUnparseableConditionUnchanged() {
    String condition = "matchAnyTag('A.B'";
    assertEquals(
        condition, PolicyConditionUpdater.removeFromCondition(condition, "A.B", TAG_FUNCTIONS));
  }

  /** A computed argument is not an entity name, so the call is left as written. */
  @Test
  void removeFromCondition_leavesACallWithAComputedArgumentUnchanged() {
    String condition = "matchAnyTag('A.B', isOwner())";
    assertEquals(
        condition, PolicyConditionUpdater.removeFromCondition(condition, "A.B", TAG_FUNCTIONS));
  }

  // ===================================================================
  // DELETED REFERENCES
  // ===================================================================

  /**
   * matchAllTags needs every tag, and a deleted tag is on no asset, so losing any one argument
   * means the call can no longer match.
   */
  @Test
  void removeFromCondition_matchAllTagsNeverMatchesOnceAnyTagIsDeleted() {
    assertEquals(
        "false",
        PolicyConditionUpdater.removeFromCondition(
            "matchAllTags('A.B', 'C.D')", "A.B", TAG_FUNCTIONS));
  }

  @Test
  void removeByPrefixFromCondition_matchAllTagsNeverMatchesOnceAnyTagIsDeleted() {
    assertEquals(
        "false",
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAllTags('PII.Name', 'Tier.Tier1')", "PII", TAG_FUNCTIONS));
  }

  /** No asset carries a deleted tag, so "not tagged with it" now holds everywhere. */
  @Test
  void removeFromCondition_keepsTheNegationAroundADeletedCall() {
    assertEquals(
        "!false",
        PolicyConditionUpdater.removeFromCondition("!matchAnyTag('A.B')", "A.B", TAG_FUNCTIONS));
  }

  @Test
  void removeFromCondition_producesConditionsThePolicyValidatorAccepts() {
    for (String condition :
        List.of(
            "matchAnyTag('A.B')",
            "isOwner() && matchAnyTag('A.B')",
            "!matchAnyTag('A.B') || hasAnyRole('R1')")) {
      String rewritten =
          PolicyConditionUpdater.removeFromCondition(condition, "A.B", TAG_FUNCTIONS);
      assertDoesNotThrow(() -> CompiledRule.parseExpression(rewritten), rewritten);
    }
  }

  private static FunctionCall onlyCall(String condition, Set<String> functions) {
    List<FunctionCall> calls = PolicyConditionUpdater.findCalls(condition, functions);
    assertEquals(1, calls.size(), condition);
    return calls.getFirst();
  }
}
