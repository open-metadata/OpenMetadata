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
package org.openmetadata.service.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;

/** Which entity types a hybrid search covers when its caller names none. */
class HybridSearchScopeTest {

  private static Map<String, IndexMapping> shipped;

  @BeforeAll
  static void loadShippedIndexMapping() throws IOException {
    IndexMappingLoader.init();
    shipped = IndexMappingLoader.getInstance().getIndexMapping();
  }

  @Test
  void withNoTypesAskedTheScopeIsTheDataAssetTypesKeywordSearchCovers() {
    final List<String> scope = SearchRepository.hybridScope(List.of(), shipped);

    assertThat(scope)
        .contains("table", "tableColumn", "glossaryTerm", "metric", "dashboard", "tag")
        .doesNotContain(
            "aiGovernanceFramework",
            "aiGovernancePolicy",
            "testCase",
            "testSuite",
            "domain",
            "glossary",
            "user",
            "contextMemory");
    assertThat(scope)
        .containsExactlyInAnyOrderElementsOf(
            shipped.entrySet().stream()
                .filter(entry -> entry.getValue().getParentAliases().contains("dataAsset"))
                .map(Map.Entry::getKey)
                .toList());
  }

  @Test
  void typesTheCallerAsksForAreTheScope() {
    assertThat(SearchRepository.hybridScope(List.of("aiGovernancePolicy", "table"), shipped))
        .containsExactly("aiGovernancePolicy", "table");
  }

  @Test
  void withNoTypesAskedTestCasesAreSearchedByMeaningAlone() {
    assertThat(SearchRepository.meaningOnlyScope(List.of())).containsExactly("testCase");
    assertThat(SearchRepository.hybridScope(List.of(), shipped)).doesNotContain("testCase");
    assertThat(SearchRepository.meaningOnlyScope(List.of("table"))).isEmpty();
  }
}
