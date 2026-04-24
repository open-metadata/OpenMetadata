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

package org.openmetadata.csv;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

public class CsvUtilTest {
  @Test
  void testAddRecord() {
    List<String> expectedRecord = new ArrayList<>();
    List<String> actualRecord = new ArrayList<>();

    // Add string
    expectedRecord.add(null);
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, (String) null));

    expectedRecord.add("abc");
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, "abc"));

    // Add list of strings
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, null));

    expectedRecord.add("def;ghi");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, listOf("def", "ghi")));

    // Add entity reference
    expectedRecord.add(null);
    assertEquals(
        expectedRecord, CsvUtil.addEntityReference(actualRecord, null)); // Null entity reference

    expectedRecord.add("fqn");
    assertEquals(
        expectedRecord,
        CsvUtil.addEntityReference(
            actualRecord, new EntityReference().withFullyQualifiedName("fqn")));

    // Add entity references
    expectedRecord.add(null);
    assertEquals(
        expectedRecord, CsvUtil.addEntityReferences(actualRecord, null)); // Null entity references

    expectedRecord.add("fqn1;fqn2");
    List<EntityReference> refs =
        listOf(
            new EntityReference().withFullyQualifiedName("fqn1"),
            new EntityReference().withFullyQualifiedName("fqn2"));
    assertEquals(expectedRecord, CsvUtil.addEntityReferences(actualRecord, refs));

    // Add tag labels
    expectedRecord.add(null);
    assertEquals(
        expectedRecord, CsvUtil.addTagLabels(actualRecord, null)); // Null entity references

    expectedRecord.add("t1;t2");
    List<TagLabel> tags = listOf(new TagLabel().withTagFQN("t1"), new TagLabel().withTagFQN("t2"));
    assertEquals(expectedRecord, CsvUtil.addTagLabels(actualRecord, tags));

    // Add extension
    expectedRecord.add(null);
    assertEquals(expectedRecord, CsvUtil.addExtension(actualRecord, null)); // Null extension

    ObjectMapper mapper = new ObjectMapper();
    ObjectNode jsonNode = mapper.createObjectNode();

    // Add new custom property stringCp of type string
    CustomProperty stringCp =
        new CustomProperty()
            .withName("stringCp")
            .withDescription("string type custom property")
            .withPropertyType(
                new EntityReference().withFullyQualifiedName("string").withType("type"));
    JsonNode stringCpValue =
        mapper.convertValue("String; input; with; semicolon\n And new line", JsonNode.class);
    jsonNode.set("stringCp", stringCpValue);

    // Add new custom property queryCp of type sqlQuery
    JsonNode queryCpValue =
        mapper.convertValue("SELECT * FROM table WHERE column = 'value';", JsonNode.class);
    jsonNode.set("queryCp", queryCpValue);

    expectedRecord.add(
        "\"stringCp:String; input; with; semicolon\n And new line\";\"queryCp:SELECT * FROM table WHERE column = 'value';\"");
    assertEquals(expectedRecord, CsvUtil.addExtension(actualRecord, jsonNode));
  }

  @Test
  void testFormattingAndSplitHelpersHandleQuotedAndBlankFields() {
    assertEquals("", CsvUtil.recordToString((List<String>) null));
    assertEquals(
        "plain,\"with,comma\",\"with;semicolon\"",
        CsvUtil.recordToString(List.of("plain", "with,comma", "with;semicolon")));
    assertEquals("alpha,beta", CsvUtil.recordToString(new String[] {"alpha", "beta"}));
    assertEquals("\"quoted\"", CsvUtil.quote("quoted"));
    assertEquals(
        "plain;\"needs,quote\";\"needs;quote\"",
        CsvUtil.quoteField(List.of("plain", "needs,quote", "needs;quote")));

    List<String> booleanRecord = new ArrayList<>();
    CsvUtil.addField(booleanRecord, Boolean.TRUE);
    CsvUtil.addField(booleanRecord, (Boolean) null);
    assertEquals(List.of("true", ""), booleanRecord);

    assertEquals(List.of("one", "two", "three"), CsvUtil.fieldToStrings(" one ; two ; three "));
    assertNull(CsvUtil.fieldToStrings(" "));

    assertEquals(List.of("user", "alice"), CsvUtil.fieldToEntities(" user : alice "));
    assertNull(CsvUtil.fieldToEntities(null));

    assertEquals(
        List.of("one", "two", "three"), CsvUtil.fieldToInternalArray(" one | two | three "));
    assertEquals(List.of(), CsvUtil.fieldToInternalArray(" "));
  }

  @Test
  void testFieldParsersRespectQuotedDelimiters() throws Exception {
    assertEquals(
        List.of("key1:value1", "key2:value2", "key3:value;with;semicolon"),
        CsvUtil.fieldToExtensionStrings("key1:value1;key2:value2;\"key3:value;with;semicolon\""));
    assertEquals(List.of(), CsvUtil.fieldToExtensionStrings(" "));

    assertEquals(
        List.of("value1", "value2", "value,with,comma"),
        CsvUtil.fieldToColumns("value1,value2,\"value,with,comma\""));
    assertEquals(List.of(), CsvUtil.fieldToColumns(" "));
  }

  @Test
  void testTagAndReferenceExportHelpersFilterExpectedValues() {
    List<TagLabel> tags =
        List.of(
            new TagLabel()
                .withTagFQN("PersonalData.Personal")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL),
            new TagLabel()
                .withTagFQN("Tier.Tier1")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL),
            new TagLabel()
                .withTagFQN("Glossary.Term")
                .withSource(TagLabel.TagSource.GLOSSARY)
                .withLabelType(TagLabel.LabelType.MANUAL),
            new TagLabel()
                .withTagFQN("Ignore.Derived")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.DERIVED));

    List<String> csvRecord = new ArrayList<>();
    CsvUtil.addTagLabels(csvRecord, tags);
    CsvUtil.addGlossaryTerms(csvRecord, tags);
    CsvUtil.addTagTiers(csvRecord, tags);
    CsvUtil.addOwners(
        csvRecord,
        List.of(
            new EntityReference().withType("user").withName("alice"),
            new EntityReference().withType("team").withName("engineering")));
    CsvUtil.addDomains(
        csvRecord,
        List.of(
            new EntityReference().withFullyQualifiedName("finance"),
            new EntityReference().withFullyQualifiedName("marketing")));
    CsvUtil.addReviewers(
        csvRecord, List.of(new EntityReference().withType("user").withName("bob")));

    assertEquals(
        List.of(
            "PersonalData.Personal",
            "Glossary.Term",
            "Tier.Tier1",
            "user:alice;team:engineering",
            "finance;marketing",
            "user:bob"),
        csvRecord);
  }

  @Test
  void testAddExtensionFormatsStructuredValues() {
    LinkedHashMap<String, Object> extension = new LinkedHashMap<>();
    extension.put("owner", Map.of("type", "user", "fullyQualifiedName", "alice"));
    extension.put("window", Map.of("start", 100, "end", 200));
    extension.put(
        "matrix",
        Map.of(
            "columns",
            List.of("name", "value"),
            "rows",
            List.of(
                Map.of("name", "alpha", "value", "beta"),
                Map.of("name", "gamma", "value", "delta,with,comma"))));
    extension.put(
        "reviewers",
        List.of(
            Map.of("type", "user", "fullyQualifiedName", "alice"),
            Map.of("type", "team", "fullyQualifiedName", "engineering")));
    extension.put("options", List.of("one", "two"));
    extension.put("empty", List.of());
    extension.put("blank", " ");
    extension.put("count", 5);
    extension.put("metadata", Map.of("key", "value"));

    List<String> csvRecord = new ArrayList<>();
    CsvUtil.addExtension(csvRecord, extension);

    String extensionField = csvRecord.get(0);
    assertTrue(extensionField.contains("owner:user:alice"));
    assertTrue(extensionField.contains("window:100:200"));
    assertTrue(extensionField.contains("reviewers:user:alice|team:engineering"));
    assertTrue(extensionField.contains("options:one|two"));
    assertFalse(extensionField.contains("empty"));
    assertFalse(extensionField.contains("blank"));
    assertTrue(extensionField.contains("count:5"));
    assertTrue(extensionField.contains("metadata:{key=value}"));
    assertTrue(extensionField.contains("matrix:alpha,beta|gamma"));
    assertTrue(extensionField.contains("delta,with,comma"));
  }

  public static void assertCsv(String expectedCsv, String actualCsv) {
    // Break a csv text into records, sort it and compare
    List<String> expectedCsvRecords = listOf(expectedCsv.split(CsvUtil.LINE_SEPARATOR));
    List<String> actualCsvRecords = listOf(actualCsv.split(CsvUtil.LINE_SEPARATOR));
    assertEquals(
        expectedCsvRecords.size(),
        actualCsvRecords.size(),
        "Expected " + expectedCsv + " actual " + actualCsv);
    Collections.sort(expectedCsvRecords);
    Collections.sort(actualCsvRecords);
    for (int i = 0; i < expectedCsvRecords.size(); i++) {
      assertEquals(expectedCsvRecords.get(i), actualCsvRecords.get(i));
    }
  }
}
