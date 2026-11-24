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
package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

class VectorIndexServiceTest {

  @Test
  void parameterSearchDelegatesWhenNoCompiledFilterIsPresent() {
    VectorIndexService service = mock(VectorIndexService.class, Answers.CALLS_REAL_METHODS);
    VectorSearchResponse expected = new VectorSearchResponse(1L, List.of());
    doReturn(expected)
        .when(service)
        .search(eq("query"), eq(Map.of()), eq(10), eq(2), eq(100), eq(0.4), isNull(), isNull());
    VectorSearchParameters parameters =
        new VectorSearchParameters("query", Map.of(), 10, 2, 100, 0.4, null, null, null);

    assertSame(expected, service.search(parameters));
  }

  @Test
  void parameterSearchRejectsACompiledFilterUnlessTheBackendImplementsIt() {
    VectorIndexService service = mock(VectorIndexService.class, Answers.CALLS_REAL_METHODS);
    VectorSearchParameters parameters =
        new VectorSearchParameters(
            "query", Map.of(), 10, 0, 100, 0.0, null, null, "{\"query\":{\"match_all\":{}}}");

    assertThrows(UnsupportedOperationException.class, () -> service.search(parameters));
  }
}
