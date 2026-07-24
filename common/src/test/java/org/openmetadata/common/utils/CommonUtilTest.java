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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;

class CommonUtilTest {

  private static final JsonNodeFactory FACTORY = JsonNodeFactory.instance;
  private static final List<String> JAR_NAME_FILTER = List.of("openmetadata", "collate");
  private static final Pattern COMMON_UTIL_CLASS_PATTERN =
      Pattern.compile(
          ".*org[/\\\\]openmetadata[/\\\\]common[/\\\\]utils[/\\\\]CommonUtil(?:Test)?\\.class$");

  @Test
  void getResourcesMatchesDirectClasspathWalk() throws IOException {
    List<String> indexedResources = CommonUtil.getResources(COMMON_UTIL_CLASS_PATTERN);
    List<String> directlyWalkedResources = getResourcesDirectly(COMMON_UTIL_CLASS_PATTERN);

    assertFalse(indexedResources.isEmpty());
    assertEquals(sorted(directlyWalkedResources), sorted(indexedResources));
  }

  @Test
  void getResourcesReturnsMutableListWithoutExposingCachedIndex() throws IOException {
    List<String> resources = CommonUtil.getResources(COMMON_UTIL_CLASS_PATTERN);
    List<String> expectedResources = new ArrayList<>(resources);

    resources.clear();
    resources.add("caller-owned-resource");

    List<String> resourcesFromCache = CommonUtil.getResources(COMMON_UTIL_CLASS_PATTERN);
    assertEquals(expectedResources, resourcesFromCache);
    assertFalse(resourcesFromCache.contains("caller-owned-resource"));
  }

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

  private static List<String> getResourcesDirectly(Pattern pattern) throws IOException {
    String classPath = System.getProperty("java.class.path", ".");
    Set<String> classPathElements =
        Arrays.stream(classPath.split(File.pathSeparator))
            .filter(jarName -> JAR_NAME_FILTER.stream().anyMatch(jarName.toLowerCase()::contains))
            .collect(Collectors.toSet());
    List<String> resources = new ArrayList<>();

    for (String element : classPathElements) {
      File file = new File(element);
      resources.addAll(
          file.isDirectory()
              ? CommonUtil.getResourcesFromDirectory(file, pattern)
              : getResourcesFromJarFile(file, pattern));
    }
    return resources;
  }

  private static List<String> getResourcesFromJarFile(File file, Pattern pattern) {
    List<String> resources = new ArrayList<>();
    try (ZipFile zipFile = new ZipFile(file)) {
      Enumeration<? extends ZipEntry> entries = zipFile.entries();
      while (entries.hasMoreElements()) {
        String fileName = entries.nextElement().getName();
        if (pattern.matcher(fileName).matches()) {
          resources.add(fileName);
        }
      }
    } catch (IOException ignored) {
      return resources;
    }
    return resources;
  }

  private static List<String> sorted(List<String> resources) {
    return resources.stream().sorted().toList();
  }
}
