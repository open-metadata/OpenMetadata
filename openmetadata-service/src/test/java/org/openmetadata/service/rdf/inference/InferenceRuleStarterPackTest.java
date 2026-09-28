/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.rdf.inference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * Unit coverage for {@link InferenceRuleStarterPack}. Verifies the classpath starter pack loads and
 * validates, and that a missing resource fails fast with a message that names the resource path.
 */
class InferenceRuleStarterPackTest {

  private static final int EXPECTED_STARTER_RULE_COUNT = 4;

  @Test
  @DisplayName("load() returns every starter rule and each passes the validator")
  void loadReturnsAllValidStarterRules() {
    List<InferenceRule> rules = InferenceRuleStarterPack.load();

    assertNotNull(rules);
    assertEquals(EXPECTED_STARTER_RULE_COUNT, rules.size());
    for (InferenceRule rule : rules) {
      assertNotNull(rule.getName(), "Loaded rule must have a name");
      List<String> errors = InferenceRuleValidator.validate(rule);
      assertTrue(
          errors.isEmpty(),
          "Starter rule '" + rule.getName() + "' must validate cleanly. Got: " + errors);
    }
  }

  @Test
  @DisplayName("load() rules are the expected named starter pack and are all enabled")
  void loadReturnsExpectedNamedRules() {
    List<InferenceRule> rules = InferenceRuleStarterPack.load();

    List<String> names = rules.stream().map(InferenceRule::getName).toList();
    assertTrue(names.contains("transitive-lineage-closure"), "Got names: " + names);
    assertTrue(names.contains("pii-propagation-via-lineage"), "Got names: " + names);
    assertTrue(names.contains("schema-tag-inheritance"), "Got names: " + names);
    assertTrue(names.contains("domain-membership-inheritance"), "Got names: " + names);
    for (InferenceRule rule : rules) {
      assertNotNull(rule.getRuleType(), "Rule '" + rule.getName() + "' must declare a ruleType");
      assertFalse(rule.getRuleBody().isBlank(), "Rule '" + rule.getName() + "' must have a body");
    }
  }

  @Test
  @DisplayName("requireResource fails fast with the missing resource path in the message")
  void requireResourceFailsFastWhenMissing() {
    String missingPath = "/rdf/inference-rules/does-not-exist.json";

    IllegalStateException thrown =
        assertThrows(IllegalStateException.class, () -> invokeRequireResource(missingPath));

    assertTrue(
        thrown.getMessage().contains(missingPath),
        "Fail-fast message must name the missing resource path. Got: " + thrown.getMessage());
    assertTrue(
        thrown.getMessage().contains("missing"),
        "Fail-fast message must state the resource is missing. Got: " + thrown.getMessage());
  }

  @Test
  @DisplayName("requireResource resolves an existing starter-pack resource to a non-null URL")
  void requireResourceResolvesExistingResource() throws Exception {
    Object url = invokeRequireResourceRaw("/rdf/inference-rules/transitive-lineage-closure.json");

    assertNotNull(url, "An existing classpath resource must resolve to a non-null URL");
  }

  private static void invokeRequireResource(String resourcePath) {
    try {
      invokeRequireResourceRaw(resourcePath);
    } catch (InvocationTargetException exception) {
      Throwable cause = exception.getCause();
      assertInstanceOf(
          IllegalStateException.class,
          cause,
          "requireResource must throw IllegalStateException, got: " + cause);
      throw (IllegalStateException) cause;
    } catch (ReflectiveOperationException exception) {
      throw new AssertionError("Unable to invoke requireResource reflectively", exception);
    }
  }

  private static Object invokeRequireResourceRaw(String resourcePath)
      throws ReflectiveOperationException {
    Method method =
        InferenceRuleStarterPack.class.getDeclaredMethod("requireResource", String.class);
    method.setAccessible(true);
    return method.invoke(null, resourcePath);
  }
}
