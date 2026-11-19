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

import java.util.List;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * One hybrid search: the question, the word query the search settings build for it, the index or
 * alias each leg searches, the entity types both legs are held to and those only the meaning leg
 * searches, the caller's search access
 * filter (the clause keyword search adds for this caller; null when keyword search adds none), how
 * many entities to return, and the caller.
 */
public record HybridSearchRequest(
    String query,
    String lexicalQuery,
    String wordIndex,
    String meaningIndex,
    List<String> entityTypes,
    List<String> byMeaningOnly,
    String accessFilter,
    int size,
    SubjectContext subjectContext) {

  public HybridSearchRequest {
    entityTypes = List.copyOf(entityTypes);
    byMeaningOnly = List.copyOf(byMeaningOnly);
  }
}
