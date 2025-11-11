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

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.Function;

/**
 * Utility class for validating SpEL expressions to prevent code injection.
 */
@Slf4j
public class ExpressionValidator {
  // Cache of allowed function names from RuleEvaluator class
  private static final Set<String> ALLOWED_FUNCTIONS = initAllowedFunctions();

  // Patterns that indicate potentially dangerous expressions
  // Using precise regex patterns to avoid false positives while maintaining security
  // Each pattern uses (?<![\\w$]) negative lookbehind to ensure the token isn't part of an
  // identifier
  private static final List<Pattern> DANGEROUS_PATTERNS =
      Arrays.asList(
          // SpEL type reference: T(java.lang.Runtime) - used to access static methods
          Pattern.compile("(?<![\\w$])T\\s*\\("),

          // Constructor invocation: new ProcessBuilder() - prevents object instantiation
          // Requires whitespace after 'new' to avoid matching "renewable", "brand_new", etc.
          Pattern.compile("(?<![\\w$])new\\s+"),

          // System class access: System.exit(), System.getenv() - keep broad for security
          Pattern.compile("(?<![\\w$])System\\."),

          // Runtime class reference - catches Runtime.getRuntime() pattern
          Pattern.compile("(?<![\\w$])Runtime\\b"),

          // Reflection via getClass() method - requires dot prefix to ensure method call
          Pattern.compile("\\.\\s*getClass\\s*\\("),

          // ClassLoader reference - can load arbitrary bytecode
          Pattern.compile("(?<![\\w$])ClassLoader\\b"),

          // Class.forName() or any forName() call - dynamic class loading
          Pattern.compile("\\.\\s*forName\\s*\\("),

          // exec() method call - executes system commands
          Pattern.compile("\\.\\s*exec\\s*\\("),

          // eval() function call - requires function call syntax to avoid false positives
          // This prevents matching table names like "customer_evaluations"
          Pattern.compile("(?<![\\w$])eval\\s*\\("),

          // ProcessBuilder class - used to spawn system processes
          Pattern.compile("(?<![\\w$])ProcessBuilder\\b"),

          // Java reflection package - direct reflection access
          Pattern.compile("(?<![\\w$])java\\.lang\\.reflect\\b"));

  private static Set<String> initAllowedFunctions() {
    Set<String> allowedFunctions = new HashSet<>();
    try {
      // Classes that provide functions for policy expressions
      List<Class<?>> evaluatorClasses = new ArrayList<>();
      evaluatorClasses.add(RuleEvaluator.class);
      evaluatorClasses.addAll(getClassesAlertAndCompletion());

      for (Class<?> evaluatorClass : evaluatorClasses) {
        scanClassForFunctions(evaluatorClass, allowedFunctions);
      }

      LOG.info("Initialized {} allowed functions for policy expressions", allowedFunctions.size());
    } catch (Exception e) {
      LOG.error("Failed to initialize allowed functions", e);
      // Fallback to hardcoded list if reflection fails
      allowedFunctions.addAll(
          Arrays.asList(
              "noOwner",
              "isOwner",
              "hasDomain",
              "matchAllTags",
              "matchAnyTag",
              "matchAnyCertification",
              "matchTeam",
              "inAnyTeam",
              "hasAnyRole",
              "matchAnyEventType",
              "matchAnyFieldChange",
              "matchAnySource",
              "matchUpdatedBy",
              "matchAnyOwnerName",
              "matchAnyEntityFqn",
              "matchAnyEntityId",
              "matchTestResult",
              "filterByTableNameTestCaseBelongsTo",
              "getTestCaseStatusIfInTestSuite",
              "matchIngestionPipelineState",
              "matchPipelineState",
              "matchAnyDomain",
              "matchConversationUser",
              "isBot"));
      LOG.info("Using fallback list of {} allowed functions", allowedFunctions.size());
    }
    return allowedFunctions;
  }

  private static List<Class<?>> getClassesAlertAndCompletion() {
    List<Class<?>> evaluatorClasses = new ArrayList<>();
    List<String> classNames =
        Arrays.asList(
            "org.openmetadata.service.events.subscription.AlertsRuleEvaluator",
            "io.collate.service.apps.bundles.onboarding.CompletionEvaluator");

    for (String className : classNames) {
      try {
        Class<?> clazz = Class.forName(className);
        evaluatorClasses.add(clazz);
      } catch (ClassNotFoundException e) {
        System.err.println("Warning: Class not found - " + className);
      }
    }
    return evaluatorClasses;
  }

  private static void scanClassForFunctions(Class<?> clazz, Set<String> allowedFunctions) {
    try {
      for (Method method : clazz.getDeclaredMethods()) {
        if (method.isAnnotationPresent(Function.class)) {
          Function annotation = method.getAnnotation(Function.class);
          allowedFunctions.add(annotation.name());
          LOG.debug("Added allowed function from {}: {}", clazz.getSimpleName(), annotation.name());
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to scan functions from class {}", clazz.getName(), e);
    }
  }

  public static void validateExpressionSafety(String expression) {
    if (expression == null || expression.trim().isEmpty()) {
      return;
    }

    // Check for dangerous patterns using regex to avoid false positives
    for (Pattern pattern : DANGEROUS_PATTERNS) {
      Matcher patternMatcher = pattern.matcher(expression);
      if (patternMatcher.find()) {
        throw new IllegalArgumentException(
            "Expression contains potentially unsafe pattern: "
                + pattern.pattern()
                + ". "
                + "Only use approved policy functions with @Function annotations.");
      }
    }

    // Extract function calls from the expression
    Pattern functionPattern = Pattern.compile("\\b([a-zA-Z0-9_]+)\\s*\\(");
    Matcher matcher = functionPattern.matcher(expression);

    List<String> foundFunctions = new ArrayList<>();
    while (matcher.find()) {
      String functionName = matcher.group(1);
      // Skip empty function names and logical operators
      if (!functionName.isEmpty()
          && !functionName.equals("and")
          && !functionName.equals("or")
          && !functionName.equals("not")) {
        foundFunctions.add(functionName);
        // Check if function is allowed
        if (!ALLOWED_FUNCTIONS.contains(functionName)) {
          throw new IllegalArgumentException(
              "Function '"
                  + functionName
                  + "' is not allowed in policy expressions. "
                  + "Only use approved functions with @Function annotations in evaluator classes.");
        }
      }
    }

    LOG.debug("Validated expression contains only allowed functions: {}", foundFunctions);
  }

  public static Set<String> getAllowedFunctions() {
    return new HashSet<>(ALLOWED_FUNCTIONS);
  }
}
