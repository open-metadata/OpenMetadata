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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;

public class ExpressionValidatorTest {

  @Test
  void testValidExpressions() {
    // Test valid expressions
    String[] validExpressions = {
      "noOwner()",
      "!noOwner()",
      "isOwner()",
      "hasDomain()",
      "matchAllTags('PersonalData.Personal', 'Tier.Tier1')",
      "matchAnyTag('PersonalData.Personal', 'Tier.Tier1')",
      "matchAnyCertification('Certification.Silver', 'Certification.Gold')",
      "matchTeam()",
      "inAnyTeam('marketing')",
      "hasAnyRole('DataSteward', 'DataEngineer')",
      "noOwner() && !isOwner()",
      "noOwner() || isOwner()",
      "!noOwner() && isOwner()",
      "matchAllTags('PersonalData.Personal') && hasAnyRole('DataSteward')"
    };

    for (String expression : validExpressions) {
      assertDoesNotThrow(
          () -> ExpressionValidator.validateExpressionSafety(expression),
          "Valid expression '" + expression + "' should not throw an exception");
    }
  }

  @Test
  void testInvalidExpressions() {
    // Test expressions with disallowed patterns
    String[] invalidExpressions = {
      "T(java.lang.System).exit(0)",
      "new java.io.File('/etc/passwd')",
      "System.getProperty('user.home')",
      "Runtime.getRuntime().exec('ls')",
      "this.getClass().getClassLoader()",
      "Class.forName('java.lang.Runtime')",
      "someObject.getClass()",
      "ProcessBuilder('ls').start()",
      "eval('System.exit(0)')",
      "java.lang.reflect.Method.invoke()"
    };

    for (String expression : invalidExpressions) {
      Exception exception =
          assertThrows(
              IllegalArgumentException.class,
              () -> ExpressionValidator.validateExpressionSafety(expression),
              "Invalid expression '" + expression + "' should throw an IllegalArgumentException");

      assertTrue(
          exception.getMessage().contains("potentially unsafe pattern")
              || exception.getMessage().contains("is not allowed in policy expressions"),
          "Exception message should indicate unsafe pattern or disallowed function");
    }
  }

  @Test
  void testInvalidFunctionNames() {
    // Test expressions with function names not in RuleEvaluator
    String[] invalidFunctions = {
      "deleteAllData()",
      "executeQuery('DELETE FROM users')",
      "runCommand('rm -rf /')",
      "customMethod()"
    };

    for (String expression : invalidFunctions) {
      Exception exception =
          assertThrows(
              IllegalArgumentException.class,
              () -> ExpressionValidator.validateExpressionSafety(expression),
              "Expression with invalid function '"
                  + expression
                  + "' should throw an IllegalArgumentException");

      assertTrue(
          exception.getMessage().contains("is not allowed in policy expressions"),
          "Exception should mention that the function is not allowed");
    }
  }

  @Test
  void testAllowedFunctionsFromRuleEvaluator() {
    // Verify that the validator properly extracts all functions from RuleEvaluator
    Set<String> allowedFunctions = ExpressionValidator.getAllowedFunctions();

    // These functions should be present (from RuleEvaluator)
    assertTrue(allowedFunctions.contains("noOwner"), "noOwner should be an allowed function");
    assertTrue(allowedFunctions.contains("isOwner"), "isOwner should be an allowed function");
    assertTrue(allowedFunctions.contains("hasDomain"), "hasDomain should be an allowed function");
    assertTrue(
        allowedFunctions.contains("matchAllTags"), "matchAllTags should be an allowed function");
    assertTrue(
        allowedFunctions.contains("matchAnyTag"), "matchAnyTag should be an allowed function");
    assertTrue(
        allowedFunctions.contains("matchAnyCertification"),
        "matchAnyCertification should be an allowed function");
    assertTrue(allowedFunctions.contains("matchTeam"), "matchTeam should be an allowed function");
    assertTrue(allowedFunctions.contains("inAnyTeam"), "inAnyTeam should be an allowed function");
    assertTrue(allowedFunctions.contains("hasAnyRole"), "hasAnyRole should be an allowed function");

    // These functions should not be present
    assertFalse(allowedFunctions.contains("deleteAllData"), "deleteAllData should not be allowed");
    assertFalse(allowedFunctions.contains("executeQuery"), "executeQuery should not be allowed");
    assertFalse(allowedFunctions.contains("runCommand"), "runCommand should not be allowed");
  }

  @Test
  void testNullAndEmptyExpressions() {
    // Test null and empty expressions (should not throw)
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety(null),
        "Null expression should not throw an exception");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety(""),
        "Empty expression should not throw an exception");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("  "),
        "Whitespace expression should not throw an exception");
  }
}
