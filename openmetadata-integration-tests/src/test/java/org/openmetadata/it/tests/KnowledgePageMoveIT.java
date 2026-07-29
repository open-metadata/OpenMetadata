/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

/**
 * End-to-end coverage for moving Knowledge Center pages across the hierarchy. Asserts that a page's
 * fullyQualifiedName is recomputed as {@code <parentFqn>.<name>} on every reparent, that the rename
 * cascades to descendants, and that a move which would create a cycle (a page under itself or one of
 * its own descendants) is rejected with a 400 rather than corrupting the subtree's FQNs.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class KnowledgePageMoveIT {

  private static final String KC_PATH = "v1/contextCenter/pages";

  private Page create(RestClient rest, String name, EntityReference parent)
      throws HttpResponseException {
    CreatePage request =
        new CreatePage()
            .withName(name)
            .withPageType(PageType.ARTICLE)
            .withDescription("Move IT page")
            .withPage(new Article())
            .withParent(parent);
    return rest.create(KC_PATH, request, Page.class);
  }

  /** Reparent {@code page} under {@code newParent} (null = move to top) via PATCH and return it. */
  private Page move(RestClient rest, Page page, EntityReference newParent)
      throws HttpResponseException {
    Page original = rest.getById(KC_PATH, page.getId(), "parent", Page.class);
    String originalJson = JsonUtils.pojoToJson(original);
    Page updated = JsonUtils.readValue(originalJson, Page.class).withParent(newParent);
    return rest.patch(KC_PATH, page.getId(), originalJson, updated, Page.class);
  }

  private String fqnOf(RestClient rest, Page page) throws HttpResponseException {
    return rest.getById(KC_PATH, page.getId(), "parent", Page.class).getFullyQualifiedName();
  }

  private String nested(Page parent, Page child) {
    return parent.getFullyQualifiedName() + "." + child.getName();
  }

  @Test
  void createNestedSetsFqnAtEachLevel(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page c = create(rest, ns.prefix("c"), p.getEntityReference());
    Page g = create(rest, ns.prefix("g"), c.getEntityReference());

    assertEquals(p.getName(), p.getFullyQualifiedName());
    assertEquals(nested(p, c), c.getFullyQualifiedName());
    assertEquals(nested(c, g), g.getFullyQualifiedName());
  }

  @Test
  void moveTopLevelPageUnderParentNestsFqn(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page x = create(rest, ns.prefix("x"), null);
    assertEquals(x.getName(), x.getFullyQualifiedName());

    Page moved = move(rest, x, p.getEntityReference());
    assertEquals(nested(p, x), moved.getFullyQualifiedName());
  }

  @Test
  void moveCascadesFqnToDescendants(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page c = create(rest, ns.prefix("c"), p.getEntityReference());
    Page g = create(rest, ns.prefix("g"), c.getEntityReference());
    Page dest = create(rest, ns.prefix("dest"), null);

    Page movedC = move(rest, c, dest.getEntityReference());

    assertEquals(nested(dest, c), movedC.getFullyQualifiedName());
    assertEquals(
        movedC.getFullyQualifiedName() + "." + g.getName(),
        fqnOf(rest, g),
        "Grandchild FQN must cascade when its ancestor is moved");
  }

  @Test
  void moveLeafToTopFlattensFqn(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page c = create(rest, ns.prefix("c"), p.getEntityReference());
    assertEquals(nested(p, c), c.getFullyQualifiedName());

    Page moved = move(rest, c, null);
    assertEquals(c.getName(), moved.getFullyQualifiedName());
  }

  @Test
  void sameLevelReparentRecomputesFqn(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p1 = create(rest, ns.prefix("p1"), null);
    Page p2 = create(rest, ns.prefix("p2"), null);
    Page c = create(rest, ns.prefix("c"), p1.getEntityReference());
    assertEquals(nested(p1, c), c.getFullyQualifiedName());

    Page moved = move(rest, c, p2.getEntityReference());
    assertEquals(nested(p2, c), moved.getFullyQualifiedName());
  }

  @Test
  void moveUnderOwnDescendantIsRejected(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page c = create(rest, ns.prefix("c"), p.getEntityReference());

    HttpResponseException ex =
        assertThrows(HttpResponseException.class, () -> move(rest, p, c.getEntityReference()));
    assertEquals(400, ex.getStatusCode());
    // The rejected move must not corrupt the FQNs.
    assertEquals(p.getName(), fqnOf(rest, p));
    assertEquals(nested(p, c), fqnOf(rest, c));
  }

  @Test
  void moveUnderSelfIsRejected(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);

    HttpResponseException ex =
        assertThrows(HttpResponseException.class, () -> move(rest, p, p.getEntityReference()));
    assertEquals(400, ex.getStatusCode());
  }

  @Test
  void deepReparentCascadesMultipleLevels(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page p = create(rest, ns.prefix("p"), null);
    Page a = create(rest, ns.prefix("a"), p.getEntityReference());
    Page b = create(rest, ns.prefix("b"), a.getEntityReference());
    Page cc = create(rest, ns.prefix("cc"), b.getEntityReference());
    Page dest = create(rest, ns.prefix("dest"), null);

    Page movedA = move(rest, a, dest.getEntityReference());
    String aFqn = movedA.getFullyQualifiedName();
    assertEquals(nested(dest, a), aFqn);
    assertEquals(aFqn + "." + b.getName(), fqnOf(rest, b));
    assertEquals(aFqn + "." + b.getName() + "." + cc.getName(), fqnOf(rest, cc));
  }
}
