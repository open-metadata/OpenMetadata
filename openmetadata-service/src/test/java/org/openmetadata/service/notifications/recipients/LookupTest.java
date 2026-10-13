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

package org.openmetadata.service.notifications.recipients;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.EntityNotFoundException;

class LookupTest {

  @Test
  void aValueIsFound() {
    assertEquals(new Lookup.Found<>("alice"), Lookup.of("a user", () -> "alice"));
  }

  // A user who was deleted, an entity with no owners, a field the type does not have.
  @Test
  void nothingThereIsAnAnswer() {
    assertInstanceOf(Lookup.Absent.class, Lookup.of("a user", () -> null));
    assertInstanceOf(
        Lookup.Absent.class,
        Lookup.of(
            "a user",
            () -> {
              throw EntityNotFoundException.byMessage("user not found");
            }));
    assertInstanceOf(
        Lookup.Absent.class,
        Lookup.of(
            "the owners",
            () -> {
              throw new IllegalArgumentException("no owners field");
            }));
  }

  @Test
  void aReadThatWentWrongIsAFailureNamingWhatWasRead() {
    Lookup<String> answer =
        Lookup.of(
            "team A",
            () -> {
              throw new IllegalStateException("the database did not answer");
            });

    Lookup.Failed<String> failed = assertInstanceOf(Lookup.Failed.class, answer);
    assertTrue(failed.reason().startsWith("team A: "));
    assertTrue(failed.reason().contains("the database did not answer"));
  }
}
