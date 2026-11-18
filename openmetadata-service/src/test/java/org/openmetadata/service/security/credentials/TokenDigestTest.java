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

package org.openmetadata.service.security.credentials;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class TokenDigestTest {
  private static final String TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJib3QifQ.c2lnbmF0dXJl";

  @Test
  void equalTokensGiveEqualDigestsAndHashCodes() {
    TokenDigest first = TokenDigest.of(TOKEN);
    TokenDigest second = TokenDigest.of(new String(TOKEN.toCharArray()));

    assertEquals(first, second);
    assertEquals(first.hashCode(), second.hashCode());
  }

  @Test
  void oneChangedCharacterGivesADifferentDigest() {
    String changed = TOKEN.substring(0, TOKEN.length() - 1) + "x";

    assertNotEquals(TokenDigest.of(TOKEN), TokenDigest.of(changed));
  }

  @Test
  void digestIsNotEqualToOtherTypesOrNull() {
    TokenDigest digest = TokenDigest.of(TOKEN);

    assertNotEquals(null, digest);
    assertNotEquals(TOKEN, digest);
  }

  @Test
  void concurrentDigestsOfOneTokenAreEqual() throws Exception {
    TokenDigest expected = TokenDigest.of(TOKEN);
    Callable<TokenDigest> digest = () -> TokenDigest.of(TOKEN);
    try (ExecutorService pool = Executors.newFixedThreadPool(16)) {
      List<Future<TokenDigest>> results =
          IntStream.range(0, 2000).mapToObj(i -> pool.submit(digest)).toList();
      for (Future<TokenDigest> result : results) {
        assertEquals(expected, result.get());
      }
    }
  }
}
