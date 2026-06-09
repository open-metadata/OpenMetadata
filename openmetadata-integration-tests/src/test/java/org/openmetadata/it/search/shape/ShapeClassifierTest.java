/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ShapeClassifierTest {

  @Test
  void classifiesTotalFields() {
    assertEquals(
        Outcome.REJECT_FIELDS,
        ShapeClassifier.classifyError("Limit of total fields [1000] has been exceeded"));
  }

  @Test
  void classifiesSize413() {
    assertEquals(Outcome.REJECT_SIZE, ShapeClassifier.classifyError("Request Entity Too Large"));
  }

  @Test
  void classifiesKeywordTermBytes() {
    assertEquals(
        Outcome.REJECT_SIZE,
        ShapeClassifier.classifyError(
            "max_bytes_length_exceeded_exception: bytes can be at most 32766 in length"));
  }

  @Test
  void classifiesNested() {
    assertEquals(
        Outcome.REJECT_NESTED,
        ShapeClassifier.classifyError(
            "The number of nested documents has exceeded the allowed limit of [10000]"));
  }

  @Test
  void classifiesDepth() {
    assertEquals(
        Outcome.REJECT_DEPTH,
        ShapeClassifier.classifyError("Limit of mapping depth [20] has been exceeded"));
  }

  @Test
  void classifiesParse() {
    assertEquals(
        Outcome.REJECT_PARSE,
        ShapeClassifier.classifyError("mapper_parsing_exception: failed to parse field"));
  }

  @Test
  void classifiesUnknownAsOther() {
    assertEquals(Outcome.ERROR_OTHER, ShapeClassifier.classifyError("connection reset"));
  }
}
