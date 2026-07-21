/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyStudioAssetCluster;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.search.InheritedFieldEntitySearch.OntologyStudioAssetBucket;

class GlossaryTermRepositoryOntologyStudioTest {

  @Test
  void excludesTermsWithoutAnAuthorizedAssetBucket() {
    GlossaryTerm visible = term("Visible");
    GlossaryTerm hidden = term("Hidden");
    OntologyStudioAssetBucket visibleBucket =
        new OntologyStudioAssetBucket(visible.getFullyQualifiedName(), 2, List.of());

    List<OntologyStudioAssetCluster> clusters =
        GlossaryTermRepository.studioClusters(
            List.of(visible, hidden), Map.of(visible.getFullyQualifiedName(), visibleBucket));
    List<GlossaryTerm> visibleTerms =
        GlossaryTermRepository.visibleStudioTerms(List.of(visible, hidden), clusters);

    assertEquals(1, clusters.size());
    assertEquals(visible.getId(), clusters.getFirst().getTerm().getId());
    assertEquals(2, clusters.getFirst().getAssetCount());
    assertEquals(List.of(visible), visibleTerms);
  }

  private static GlossaryTerm term(String name) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("Studio." + name);
  }
}
