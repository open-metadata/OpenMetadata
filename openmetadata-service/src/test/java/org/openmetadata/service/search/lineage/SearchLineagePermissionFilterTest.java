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

package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class SearchLineagePermissionFilterTest {
  private static final String ROOT = "svc.db.schema.root";
  private static final String HIDDEN = "svc.db.schema.hidden";

  /**
   * The graph builders cache the graph they return and hand the same one to every caller, so a
   * restricted caller's view is cut from a copy and the graph is still whole for the next caller.
   */
  @Test
  void aCallersViewLeavesTheGraphItWasCutFromWhole() {
    SearchLineageResult shared = graph();
    SubjectContext restricted = mock(SubjectContext.class);
    when(restricted.isAdmin()).thenReturn(false);

    SearchLineageResult view =
        new SearchLineagePermissionFilter(mock(Authorizer.class))
            .filter(mock(SecurityContext.class), restricted, shared, ROOT);

    assertEquals(Set.of(ROOT), view.getNodes().keySet());
    assertEquals(Set.of(ROOT, HIDDEN), shared.getNodes().keySet());
    assertEquals(1, shared.getUpstreamEdges().size());
  }

  // HIDDEN carries no id, so the filter cannot identify it and leaves it out without asking the
  // authorizer: the test decides visibility without stubbing a policy.
  private static SearchLineageResult graph() {
    Map<String, NodeInformation> nodes = new HashMap<>();
    nodes.put(ROOT, node(ROOT));
    nodes.put(HIDDEN, node(HIDDEN));
    Map<String, EsLineageData> edges = new HashMap<>();
    edges.put(
        HIDDEN + "->" + ROOT,
        new EsLineageData()
            .withFromEntity(new RelationshipRef().withFullyQualifiedName(HIDDEN))
            .withToEntity(new RelationshipRef().withFullyQualifiedName(ROOT)));
    return new SearchLineageResult()
        .withNodes(nodes)
        .withUpstreamEdges(edges)
        .withDownstreamEdges(new HashMap<>());
  }

  private static NodeInformation node(String fqn) {
    return new NodeInformation().withEntity(new HashMap<>(Map.of("fullyQualifiedName", fqn)));
  }
}
