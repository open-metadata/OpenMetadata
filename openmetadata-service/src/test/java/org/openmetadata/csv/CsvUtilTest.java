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
import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

class CsvUtilTest {
  @Test
  void testQuoteField() {
    // Single string field related tests
    assertEquals("abc", CsvUtil.quoteField("abc")); // Strings without separator is not quoted
    assertEquals("\"a,bc\"", CsvUtil.quoteField("a,bc")); // Strings with separator are quoted

    // List of strings in a field related tests
    assertEquals("abc;def;ghi", CsvUtil.quoteField(listOf("abc", "def", "ghi")));
    assertEquals("\"a;bc\";\"d,ef\";ghi", CsvUtil.quoteField(listOf("a;bc", "d,ef", "ghi")));
  }

  @Test
  void testAddRecord() {
    List<String> expectedRecord = new ArrayList<>();
    List<String> actualRecord = new ArrayList<>();

    // Add string
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, null));

    expectedRecord.add("abc");
    assertEquals(expectedRecord, CsvUtil.addField(actualRecord, "abc"));

    // Add list of strings
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, null));

    expectedRecord.add("def;ghi");
    assertEquals(expectedRecord, CsvUtil.addFieldList(actualRecord, listOf("def", "ghi")));

    // Add entity reference
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addEntityReference(actualRecord, null)); // Null entity reference

    expectedRecord.add("fqn");
    assertEquals(
        expectedRecord, CsvUtil.addEntityReference(actualRecord, new EntityReference().withFullyQualifiedName("fqn")));

    // Add entity references
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addEntityReferences(actualRecord, null)); // Null entity references

    expectedRecord.add("fqn1;fqn2");
    List<EntityReference> refs =
        listOf(
            new EntityReference().withFullyQualifiedName("fqn1"), new EntityReference().withFullyQualifiedName("fqn2"));
    assertEquals(expectedRecord, CsvUtil.addEntityReferences(actualRecord, refs));

    // Add tag labels
    expectedRecord.add("");
    assertEquals(expectedRecord, CsvUtil.addTagLabels(actualRecord, null)); // Null entity references

    expectedRecord.add("t1;t2");
    List<TagLabel> tags = listOf(new TagLabel().withTagFQN("t1"), new TagLabel().withTagFQN("t2"));
    assertEquals(expectedRecord, CsvUtil.addTagLabels(actualRecord, tags));
  }
}
