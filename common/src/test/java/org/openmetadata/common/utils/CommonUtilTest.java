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
package org.openmetadata.common.utils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class CommonUtilTest {

  private static final JsonNodeFactory FACTORY = JsonNodeFactory.instance;

  @Test
  void nullOrEmpty_jsonNode_trueForNullReference() {
    assertTrue(CommonUtil.nullOrEmpty((JsonNode) null));
  }

  @Test
  void nullOrEmpty_jsonNode_trueForJsonNull() {
    assertTrue(CommonUtil.nullOrEmpty(FACTORY.nullNode()));
  }

  @Test
  void nullOrEmpty_jsonNode_trueForMissingNode() {
    assertTrue(CommonUtil.nullOrEmpty(MissingNode.getInstance()));
  }

  @Test
  void nullOrEmpty_jsonNode_trueForEmptyString() {
    assertTrue(CommonUtil.nullOrEmpty(FACTORY.textNode("")));
  }

  @Test
  void nullOrEmpty_jsonNode_trueForEmptyArray() {
    assertTrue(CommonUtil.nullOrEmpty(FACTORY.arrayNode()));
  }

  @Test
  void nullOrEmpty_jsonNode_trueForEmptyObject() {
    assertTrue(CommonUtil.nullOrEmpty(FACTORY.objectNode()));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForNonEmptyString() {
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.textNode("hello")));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForWhitespaceString() {
    // Mirrors the (String) overload's isEmpty() semantics; callers that need
    // blank-sensitive checks should use String::isBlank explicitly.
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.textNode("   ")));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForNumericNode() {
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.numberNode(0)));
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.numberNode(42)));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForBooleanNode() {
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.booleanNode(false)));
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.booleanNode(true)));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForNonEmptyArray() {
    assertFalse(CommonUtil.nullOrEmpty(FACTORY.arrayNode().add("x")));
  }

  @Test
  void nullOrEmpty_jsonNode_falseForNonEmptyObject() {
    ObjectNode obj = FACTORY.objectNode();
    obj.put("k", "v");
    assertFalse(CommonUtil.nullOrEmpty(obj));
  }

  @Test
  void nullOrEmpty_jsonNode_regressionNullNodeToStringTrap() {
    // NullNode.toString() returns "null" (4 chars) — the (Object) overload would
    // fall through to nullOrEmpty(String) and classify it as non-empty. This
    // test guards against someone accidentally deleting the JsonNode overload.
    JsonNode nullNode = FACTORY.nullNode();
    assertTrue(
        CommonUtil.nullOrEmpty(nullNode),
        "NullNode must be treated as empty — do not remove the JsonNode overload");
  }
}
