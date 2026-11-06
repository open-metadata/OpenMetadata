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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.json.JsonPatch;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class BoundedJsonPatchTest {

  @Test
  void readsAWellFormedPatch() {
    JsonPatch patch =
        BoundedJsonPatch.read("[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"x\"}]");
    assertEquals(1, patch.toJsonArray().size());
  }

  @Test
  void keepsEveryDigitOfANumberValue() {
    JsonPatch patch =
        BoundedJsonPatch.read(
            "[{\"op\":\"add\",\"path\":\"/a\",\"value\":12345678901234567.891},"
                + "{\"op\":\"add\",\"path\":\"/b\",\"value\":1e999}]");

    assertEquals(
        new BigDecimal("12345678901234567.891"),
        patch.toJsonArray().getJsonObject(0).getJsonNumber("value").bigDecimalValue());
    assertEquals(
        new BigDecimal("1e999"),
        patch.toJsonArray().getJsonObject(1).getJsonNumber("value").bigDecimalValue());
  }

  @Test
  void refusesABodyThatIsNotAnArray() {
    assertThrows(
        BoundedJsonPatch.InvalidPatchException.class,
        () -> BoundedJsonPatch.read("{\"op\":\"replace\"}"));
  }

  @Test
  void refusesMoreOperationsThanAllowed() {
    StringBuilder body = new StringBuilder("[");
    for (int i = 0; i <= BoundedJsonPatch.MAX_OPERATIONS; i++) {
      body.append(i == 0 ? "" : ",").append("{\"op\":\"test\",\"path\":\"/a\",\"value\":1}");
    }
    body.append("]");

    assertThrows(
        BoundedJsonPatch.PatchTooLargeException.class,
        () -> BoundedJsonPatch.read(body.toString()));
  }

  @Test
  void refusesAStringLongerThanTheDocumentBound() {
    String huge = "x".repeat((int) BoundedJsonPatch.MAX_DOCUMENT_LENGTH + 1);
    String body = "[{\"op\":\"add\",\"path\":\"/a\",\"value\":\"" + huge + "\"}]";

    assertThrows(BoundedJsonPatch.PatchTooLargeException.class, () -> BoundedJsonPatch.read(body));
  }
}
