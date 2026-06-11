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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.Function;
import org.springframework.expression.ParseException;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.BooleanLiteral;
import org.springframework.expression.spel.ast.Elvis;
import org.springframework.expression.spel.ast.FloatLiteral;
import org.springframework.expression.spel.ast.InlineList;
import org.springframework.expression.spel.ast.InlineMap;
import org.springframework.expression.spel.ast.IntLiteral;
import org.springframework.expression.spel.ast.LongLiteral;
import org.springframework.expression.spel.ast.MethodReference;
import org.springframework.expression.spel.ast.NullLiteral;
import org.springframework.expression.spel.ast.OpAnd;
import org.springframework.expression.spel.ast.OpEQ;
import org.springframework.expression.spel.ast.OpGE;
import org.springframework.expression.spel.ast.OpGT;
import org.springframework.expression.spel.ast.OpLE;
import org.springframework.expression.spel.ast.OpLT;
import org.springframework.expression.spel.ast.OpNE;
import org.springframework.expression.spel.ast.OpOr;
import org.springframework.expression.spel.ast.OperatorNot;
import org.springframework.expression.spel.ast.PropertyOrFieldReference;
import org.springframework.expression.spel.ast.RealLiteral;
import org.springframework.expression.spel.ast.StringLiteral;
import org.springframework.expression.spel.ast.Ternary;
import org.springframework.expression.spel.standard.SpelExpression;
import org.springframework.expression.spel.standard.SpelExpressionParser;

/**
 * Validates SpEL expressions used in alert and policy rules against a strict allowlist to
 * prevent code injection.
 *
 * <p>Strategy is AST-based default-deny. The previous regex-based approach produced repeated
 * false positives whenever user-supplied string-literal arguments contained tokens that
 * looked like dangerous syntax (e.g. a test-suite name {@code 'AENG - CSP work item bug
 * checks (duration exceeded)'} was rejected because the regex saw {@code checks(} as a
 * function call inside the string). String-literal content cannot execute code, so
 * inspecting it as syntax was architecturally wrong.
 *
 * <p>Replacement strategy:
 *
 * <ol>
 *   <li>Parse the expression with {@link SpelExpressionParser} to obtain the canonical
 *       SpEL AST. Parse failures throw {@link IllegalArgumentException}.
 *   <li>Walk the AST. A node is accepted only if its concrete class is in
 *       {@link #ALLOWED_NODE_CLASSES}: literals, boolean/comparison operators, list/map
 *       literals, ternaries, {@link MethodReference}s, and bare
 *       {@link PropertyOrFieldReference}s. Every other construct (type references,
 *       constructors, bean references, projections/selections, indexers, assignments,
 *       arithmetic, variable references, compound expressions, ...) is rejected by
 *       default-deny.
 *   <li>For {@link MethodReference} and {@link PropertyOrFieldReference} nodes, the
 *       referenced name must also be on {@link #ALLOWED_FUNCTIONS} — i.e. a method
 *       annotated with {@link Function @Function} on one of the evaluator classes.
 *       Paren-less references such as {@code !isOwner} are long-standing valid syntax
 *       (documented in {@code @Function} examples and stored in existing policies):
 *       SpEL parses them as property references and resolves them to the same
 *       zero-argument evaluator method, so they are exactly as safe as {@code isOwner()}.
 *       Chained access such as {@code System.exit} still parses as a compound
 *       expression and remains rejected.
 * </ol>
 *
 * <p>Defense-in-depth: any new SpEL syntax feature is implicitly rejected by the
 * default-deny policy until explicitly allowlisted, eliminating the bypass surface a
 * regex-based scan carries.
 */
@Slf4j
public final class ExpressionValidator {

  private static final Set<String> ALLOWED_FUNCTIONS = initAllowedFunctions();

  private static final Set<Class<?>> ALLOWED_NODE_CLASSES =
      Set.of(
          // Literals — non-executable data
          StringLiteral.class,
          IntLiteral.class,
          LongLiteral.class,
          FloatLiteral.class,
          RealLiteral.class,
          BooleanLiteral.class,
          NullLiteral.class,
          // Boolean operators — safe combinators of allowed sub-expressions
          OpAnd.class,
          OpOr.class,
          OperatorNot.class,
          // Comparison operators
          OpEQ.class,
          OpNE.class,
          OpGT.class,
          OpGE.class,
          OpLT.class,
          OpLE.class,
          // Collection literals used to pass arguments to filter functions
          InlineList.class,
          InlineMap.class,
          // Method calls and paren-less function references — both subject to the
          // ALLOWED_FUNCTIONS check below
          MethodReference.class,
          PropertyOrFieldReference.class,
          // Conditional combinators
          Ternary.class,
          Elvis.class);

  private ExpressionValidator() {}

  public static void validateExpressionSafety(String expression) {
    if (expression == null || expression.trim().isEmpty()) {
      return;
    }
    SpelExpression compiled;
    try {
      compiled = (SpelExpression) new SpelExpressionParser().parseExpression(expression);
    } catch (ParseException e) {
      throw new IllegalArgumentException("Cannot parse policy expression: " + e.getMessage(), e);
    }
    validateNode(compiled.getAST());
    LOG.debug("Validated expression: {}", expression);
  }

  public static Set<String> getAllowedFunctions() {
    return new HashSet<>(ALLOWED_FUNCTIONS);
  }

  private static void validateNode(SpelNode node) {
    if (node == null) {
      return;
    }
    ensureNodeKindAllowed(node);
    ensureReferencedNameAllowed(node);
    for (int i = 0; i < node.getChildCount(); i++) {
      validateNode(node.getChild(i));
    }
  }

  private static void ensureNodeKindAllowed(SpelNode node) {
    if (ALLOWED_NODE_CLASSES.contains(node.getClass())) {
      return;
    }
    throw new IllegalArgumentException(
        "Expression contains a disallowed SpEL construct: "
            + node.getClass().getSimpleName()
            + " ('"
            + node.toStringAST()
            + "'). Only literals, boolean/comparison operators, list/map literals, ternaries,"
            + " and calls or paren-less references to approved @Function-annotated methods"
            + " are allowed.");
  }

  private static void ensureReferencedNameAllowed(SpelNode node) {
    String name = referencedFunctionName(node);
    if (name != null && !ALLOWED_FUNCTIONS.contains(name)) {
      throw new IllegalArgumentException(
          "Function '"
              + name
              + "' is not allowed in policy expressions. "
              + "Only use approved functions with @Function annotations in evaluator classes.");
    }
  }

  private static String referencedFunctionName(SpelNode node) {
    String name = null;
    if (node instanceof MethodReference methodReference) {
      name = methodReference.getName();
    } else if (node instanceof PropertyOrFieldReference propertyReference) {
      name = propertyReference.getName();
    }
    return name;
  }

  private static Set<String> initAllowedFunctions() {
    Set<String> allowedFunctions = new HashSet<>();
    try {
      // Classes that provide functions for policy expressions
      List<Class<?>> evaluatorClasses = new ArrayList<>();
      evaluatorClasses.add(RuleEvaluator.class);
      evaluatorClasses.addAll(getClassesAlertAndCompletion());

      for (Class<?> clazz : evaluatorClasses) {
        scanClassForFunctions(clazz, allowedFunctions);
      }
      LOG.info(
          "Initialized ExpressionValidator with {} allowed functions: {}",
          allowedFunctions.size(),
          allowedFunctions);
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
              "matchDataContractStatus",
              "filterByEntityNameDataContractBelongsTo",
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
}
