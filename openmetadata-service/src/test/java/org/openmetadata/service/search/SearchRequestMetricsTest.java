/*
 *  Copyright 2025 Collate.
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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertSame;

import java.io.IOException;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.Test;

class SearchRequestMetricsTest {

  @Test
  void unwrapStripsTheAsyncCompletionWrappers() {
    IOException root = new IOException("connection reset");

    assertSame(root, SearchRequestMetrics.unwrap(root));
    assertSame(root, SearchRequestMetrics.unwrap(new CompletionException(root)));
    assertSame(root, SearchRequestMetrics.unwrap(new ExecutionException(root)));
    assertSame(
        root, SearchRequestMetrics.unwrap(new CompletionException(new ExecutionException(root))));
  }

  @Test
  void unwrapKeepsAWrapperThatCarriesNoCause() {
    CompletionException causeless = new CompletionException("no cause", null);

    assertSame(causeless, SearchRequestMetrics.unwrap(causeless));
  }
}
