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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.ROLE_FUNCTIONS;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.TAG_FUNCTIONS;
import static org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater.TEAM_FUNCTIONS;

import org.junit.jupiter.api.Test;

class PolicyConditionUpdaterTest {

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
    assertNull(result);
  }

  @Test
  void removeByPrefixFromCondition_exactPrefixMatch() {
    String result =
        PolicyConditionUpdater.removeByPrefixFromCondition(
            "matchAnyTag('PII')", "PII", TAG_FUNCTIONS);
    assertNull(result);
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
    assertEquals("hasAnyRole('Admin')", result);
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
    assertNull(result);
  }

  @Test
  void removeFromCondition_tagWithAndCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "matchAnyTag('A.B') && hasAnyRole('R1')", "A.B", TAG_FUNCTIONS);
    assertEquals("hasAnyRole('R1')", result);
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
    assertNull(result);
  }

  @Test
  void removeFromCondition_teamWithOrCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "inAnyTeam('marketing') || hasAnyRole('R1')", "marketing", TEAM_FUNCTIONS);
    assertEquals("hasAnyRole('R1')", result);
  }

  @Test
  void removeFromCondition_middleFunctionInCompoundCondition() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "hasAnyRole('R1') && matchAnyTag('A') && inAnyTeam('T1')", "A", TAG_FUNCTIONS);
    assertEquals("hasAnyRole('R1') && inAnyTeam('T1')", result);
  }

  @Test
  void removeFromCondition_multipleTagFunctions() {
    String result =
        PolicyConditionUpdater.removeFromCondition(
            "matchAllTags('A', 'B') && matchAnyTag('A')", "A", TAG_FUNCTIONS);
    assertEquals("matchAllTags('B')", result);
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
  // BOOLEAN SIMPLIFICATION TESTS
  // ===================================================================

  @Test
  void simplifyBooleanExpression_trueAndX() {
    assertEquals("X", PolicyConditionUpdater.simplifyBooleanExpression("true && X"));
  }

  @Test
  void simplifyBooleanExpression_xAndTrue() {
    assertEquals("X", PolicyConditionUpdater.simplifyBooleanExpression("X && true"));
  }

  @Test
  void simplifyBooleanExpression_trueOrX() {
    assertEquals("true", PolicyConditionUpdater.simplifyBooleanExpression("true || X"));
  }

  @Test
  void simplifyBooleanExpression_xOrTrue() {
    assertEquals("true", PolicyConditionUpdater.simplifyBooleanExpression("X || true"));
  }

  @Test
  void simplifyBooleanExpression_justTrue() {
    assertEquals("true", PolicyConditionUpdater.simplifyBooleanExpression("true"));
  }

  @Test
  void simplifyBooleanExpression_noSimplification() {
    assertEquals(
        "hasAnyRole('R1')", PolicyConditionUpdater.simplifyBooleanExpression("hasAnyRole('R1')"));
  }

  // ===================================================================
  // EXTRACT ARGS TESTS
  // ===================================================================

  @Test
  void extractArgs_singleArg() {
    assertEquals(
        java.util.List.of("A.B"), PolicyConditionUpdater.extractArgs("matchAnyTag('A.B')"));
  }

  @Test
  void extractArgs_multipleArgs() {
    assertEquals(
        java.util.List.of("A.B", "C.D"),
        PolicyConditionUpdater.extractArgs("matchAnyTag('A.B', 'C.D')"));
  }

  @Test
  void extractArgs_noArgs() {
    assertEquals(java.util.List.of(), PolicyConditionUpdater.extractArgs("isOwner()"));
  }
}
