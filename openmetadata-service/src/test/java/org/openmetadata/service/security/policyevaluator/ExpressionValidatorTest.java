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

  // T( - SpEL Type Reference
  @Test
  void testTypeReference_Positive() {
    // Legitimate expressions that contain 'T' but aren't type references
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('DWH_Redshift.ANALYTICS_DB.FACT_TABLE')"),
        "Table names with uppercase 'T' should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyTag('Tier.Tier1')"),
        "Tag names starting with 'T' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyOwnerName('Tom_Anderson') && hasDomain()"),
        "Owner names with 'T' should be allowed");
  }

  @Test
  void testTypeReference_Negative() {
    // Malicious type reference attempts
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("T(java.lang.System).exit(0)"),
        "SpEL type reference T() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("T(java.lang.Runtime).getRuntime()"),
        "Type reference to Runtime should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "noOwner() && T(java.nio.file.Files).delete()"),
        "Type reference in combined expression should be blocked");
  }

  // new - Constructor Invocation
  @Test
  void testConstructor_Positive() {
    // Legitimate expressions with "new" as substring
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('product_catalog.renewals_table')"),
        "Table name containing 'renewals' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyOwnerName('newman') && isOwner()"),
        "Names containing 'new' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('brand_new_data', 'Tier.Tier1')"),
        "Tags with underscore-separated 'new' should be allowed");
  }

  @Test
  void testConstructor_Negative() {
    // Malicious constructor attempts
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("new java.io.File('/etc/passwd')"),
        "Constructor invocation should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("new ProcessBuilder('ls', '-la')"),
        "ProcessBuilder constructor should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('PII') && new java.net.Socket()"),
        "Constructor in combined expression should be blocked");
  }

  // System. - System Class Access
  @Test
  void testSystemClass_Positive() {
    // Legitimate expressions with "System" in names
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('SystemMetrics.performance_logs')"),
        "Table names with 'System' prefix should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyTag('FileSystem.mounted')"),
        "Tags containing 'System' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyOwnerName('SystemAdministrator')"),
        "Owner names with 'System' should be allowed");
  }

  @Test
  void testSystemClass_Negative() {
    // Malicious System class access
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("System.exit(0)"),
        "System.exit() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("System.getProperty('user.home')"),
        "System.getProperty() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("System.getenv('AWS_SECRET_KEY')"),
        "System.getenv() should be blocked");
  }

  // Runtime - Runtime Class
  @Test
  void testRuntimeClass_Positive() {
    // Legitimate expressions with "Runtime" in names
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('metrics.query_runtime_stats')"),
        "Table with 'runtime' in name should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyTag('RuntimeMetrics.latency')"),
        "Tags with 'Runtime' prefix should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyDomain('PerformanceRuntimeAnalysis')"),
        "Domain names with 'Runtime' should be allowed");
  }

  @Test
  void testRuntimeClass_Negative() {
    // Malicious Runtime class usage
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("Runtime.getRuntime().exec('rm -rf /')"),
        "Runtime.getRuntime() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "Runtime.getRuntime().availableProcessors()"),
        "Runtime system info access should be blocked");
  }

  // .getClass() - Reflection via getClass
  @Test
  void testGetClassMethod_Positive() {
    // Legitimate expressions that mention "class" but don't call getClass()
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('school.student_class_roster')"),
        "Table with 'class' in name should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety("matchAnyTag('Classification.Sensitive')"),
        "Tags with 'class' substring should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyCertification('FirstClass')"),
        "Certifications with 'class' should be allowed");
  }

  @Test
  void testGetClassMethod_Negative() {
    // Malicious getClass() reflection attempts
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("someObject.getClass()"),
        "getClass() method call should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("entity.getClass().getClassLoader()"),
        "getClass() chained with getClassLoader() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("this.getClass().getName()"),
        "this.getClass() should be blocked");
  }

  // ClassLoader - ClassLoader Usage
  @Test
  void testClassLoader_Positive() {
    // Legitimate expressions with "ClassLoader" in names (unlikely but possible)
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('DataClassLoader.automated')"),
        "Tags with 'ClassLoader' as prefix should be allowed");
  }

  @Test
  void testClassLoader_Negative() {
    // Malicious ClassLoader access
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("ClassLoader.getSystemClassLoader()"),
        "ClassLoader.getSystemClassLoader() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "java.lang.ClassLoader.getSystemClassLoader()"),
        "Fully qualified ClassLoader should be blocked");
  }

  // .forName() - Dynamic Class Loading
  @Test
  void testForName_Positive() {
    // Legitimate expressions with "forName" in text
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyOwnerName('John') && matchAnyTag('PII')"),
        "matchAnyOwnerName with 'forName' substring should be allowed");
  }

  @Test
  void testForName_Negative() {
    // Malicious Class.forName() attempts
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("Class.forName('java.lang.Runtime')"),
        "Class.forName() should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety("someClass.forName('org.malicious.Code')"),
        "Any forName() call should be blocked");
  }

  // .exec() - Command Execution
  @Test
  void testExecMethod_Positive() {
    // Legitimate expressions with "exec" in names - THIS IS THE BUG FIX SCENARIO
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('analytics.query_execution_logs')"),
        "Table name with 'execution' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('ExecutiveDashboard.metrics')"),
        "Tags with 'Exec' prefix should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyOwnerName('exec_team_lead')"),
        "Owner names with 'exec' should be allowed");
  }

  @Test
  void testExecMethod_Negative() {
    // Malicious exec() command execution
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("runtime.exec('ls -la')"),
        "exec() method call should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("process.exec('cat /etc/passwd')"),
        "exec() with file access should be blocked");
  }

  // eval() - Eval Function - THE PRIMARY BUG FIX
  @Test
  void testEvalFunction_Positive() {
    // Legitimate expressions with "eval" in names - THE REPORTED BUG CASE
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('DWH_Redshift.analytics_db.core.customer_evaluations')"),
        "Table name 'customer_evaluations' should be allowed (reported bug)");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "filterByTableNameTestCaseBelongsTo('car_evaluations')"),
        "Alert filter with 'car_evaluations' table should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('hr_db.employee_evaluations')"),
        "Table name 'employee_evaluations' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('MedievalHistory.artifacts')"),
        "Tags with 'eval' substring like 'Medieval' should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyOwnerName('eval_team')"),
        "Owner name starting with 'eval' should be allowed");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('performance.eval_metrics_2024')"),
        "FQN with 'eval' as part of name should be allowed");
  }

  @Test
  void testEvalFunction_Negative() {
    // Malicious eval() function calls
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("eval('malicious code')"),
        "eval() function call should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("eval(someExpression)"),
        "eval() with variable should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyTag('PII') && eval('System.exit(0)')"),
        "eval() in combined expression should be blocked");
  }

  // ProcessBuilder - Process Spawning
  @Test
  void testProcessBuilder_Positive() {
    // Legitimate expressions with "ProcessBuilder" in names
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('etl.DataProcessBuilder_logs')"),
        "Table with 'ProcessBuilder' in name should be allowed");
  }

  @Test
  void testProcessBuilder_Negative() {
    // Malicious ProcessBuilder usage
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("new ProcessBuilder('rm', '-rf', '/')"),
        "ProcessBuilder constructor should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () -> ExpressionValidator.validateExpressionSafety("ProcessBuilder.start().waitFor()"),
        "ProcessBuilder static access should be blocked");
  }

  // java.lang.reflect - Reflection Package
  @Test
  void testReflectionPackage_Positive() {
    // Legitimate expressions with "reflect" in names
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('audit.user_reflection_logs')"),
        "Table with 'reflection' in name should be allowed");
    assertDoesNotThrow(
        () -> ExpressionValidator.validateExpressionSafety("matchAnyTag('ReflectiveThinking.ai')"),
        "Tags with 'Reflect' prefix should be allowed");
  }

  @Test
  void testReflectionPackage_Negative() {
    // Malicious reflection package access
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "java.lang.reflect.Method.invoke(target, args)"),
        "java.lang.reflect package should be blocked");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ExpressionValidator.validateExpressionSafety(
                "java.lang.reflect.Field.setAccessible(true)"),
        "Reflection field access should be blocked");
  }

  // Complex Real-World Scenarios
  @Test
  void testComplexExpressions_Positive() {
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEntityFqn('dwh.customer_evaluations', 'dwh.product_reviews') && matchTestResult('Failed')"),
        "Complex alert with multiple tables including 'evaluations' should work");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "filterByTableNameTestCaseBelongsTo('sales_db.quarterly_eval_summary') && getTestCaseStatusIfInTestSuite('Critical', 'Aborted')"),
        "Alert filtering by table with 'eval' should work");
    assertDoesNotThrow(
        () ->
            ExpressionValidator.validateExpressionSafety(
                "matchAnyEventType('entityCreated', 'entityUpdated') && matchAnyEntityFqn('production.customer_evaluations')"),
        "Event filtering with 'evaluations' table should work");
  }

  @Test
  void testInvalidFunctionNames() {
    // Test expressions with function names not in RuleEvaluator
    String[] invalidFunctions = {
      "deleteAllData()",
      "queryDatabase('DELETE FROM users')", // Changed from executeQuery to avoid 'exec' pattern
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
