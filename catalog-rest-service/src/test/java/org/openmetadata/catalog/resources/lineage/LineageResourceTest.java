/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.resources.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.lineage.AddLineage;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.TableRepository.TableEntityInterface;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.type.Edge;
import org.openmetadata.catalog.type.EntitiesEdge;
import org.openmetadata.catalog.type.EntityLineage;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LineageResourceTest extends CatalogApplicationTest {
  public static final List<Table> TABLES = new ArrayList<>();
  public static final int TABLE_COUNT = 10;

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    // Create TABLE_COUNT number of tables
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    for (int i = 0; i < TABLE_COUNT; i++) {
      CreateTable createTable = tableResourceTest.create(test, i);
      TABLES.add(tableResourceTest.createEntity(createTable, adminAuthHeaders()));
    }
  }

  @Test
  void put_delete_lineage_200() throws HttpResponseException {
    // Add lineage table4-->table5
    addEdge(TABLES.get(4), TABLES.get(5));

    // Add lineage table5-->table6
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(5), TABLES.get(6)); // PUT operation again with the same edge

    //
    // Add edges to this lineage graph
    //          table2-->      -->table9
    // table0-->table3-->table4-->table5->table6->table7
    //          table1-->      -->table8
    addEdge(TABLES.get(0), TABLES.get(3));
    addEdge(TABLES.get(2), TABLES.get(4));
    addEdge(TABLES.get(3), TABLES.get(4));
    addEdge(TABLES.get(1), TABLES.get(4));
    addEdge(TABLES.get(4), TABLES.get(9));
    addEdge(TABLES.get(4), TABLES.get(5));
    addEdge(TABLES.get(4), TABLES.get(8));
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(6), TABLES.get(7));

    // Test table4 lineage
    Edge[] expectedUpstreamEdges = {
      getEdge(TABLES.get(2), TABLES.get(4)),
      getEdge(TABLES.get(3), TABLES.get(4)),
      getEdge(TABLES.get(1), TABLES.get(4)),
      getEdge(TABLES.get(0), TABLES.get(3))
    };
    Edge[] expectedDownstreamEdges = {
      getEdge(TABLES.get(4), TABLES.get(9)),
      getEdge(TABLES.get(4), TABLES.get(5)),
      getEdge(TABLES.get(4), TABLES.get(8)),
      getEdge(TABLES.get(5), TABLES.get(6)),
      getEdge(TABLES.get(6), TABLES.get(7))
    };

    // GET lineage by id
    EntityLineage lineage = getLineage(Entity.TABLE, TABLES.get(4).getId(), 3, 3, adminAuthHeaders());
    assertEdges(lineage, expectedUpstreamEdges, expectedDownstreamEdges);

    // GET lineage by fqn
    lineage = getLineageByName(Entity.TABLE, TABLES.get(4).getFullyQualifiedName(), 3, 3, adminAuthHeaders());
    assertEdges(lineage, expectedUpstreamEdges, expectedDownstreamEdges);

    // Test table4 partial lineage with various upstream and downstream depths
    lineage = getLineage(Entity.TABLE, TABLES.get(4).getId(), 0, 0, adminAuthHeaders());
    assertEdges(
        lineage, Arrays.copyOfRange(expectedUpstreamEdges, 0, 0), Arrays.copyOfRange(expectedDownstreamEdges, 0, 0));
    lineage = getLineage(Entity.TABLE, TABLES.get(4).getId(), 1, 1, adminAuthHeaders());
    assertEdges(
        lineage, Arrays.copyOfRange(expectedUpstreamEdges, 0, 3), Arrays.copyOfRange(expectedDownstreamEdges, 0, 3));
    lineage = getLineage(Entity.TABLE, TABLES.get(4).getId(), 2, 2, adminAuthHeaders());
    assertEdges(
        lineage, Arrays.copyOfRange(expectedUpstreamEdges, 0, 4), Arrays.copyOfRange(expectedDownstreamEdges, 0, 4));

    //
    // Delete all the lineage edges
    //          table2-->      -->table9
    // table0-->table3-->table4-->table5->table6->table7
    //          table1-->      -->table8
    deleteEdge(TABLES.get(0), TABLES.get(3));
    deleteEdge(TABLES.get(3), TABLES.get(4));
    deleteEdge(TABLES.get(2), TABLES.get(4));
    deleteEdge(TABLES.get(1), TABLES.get(4));
    deleteEdge(TABLES.get(4), TABLES.get(9));
    deleteEdge(TABLES.get(4), TABLES.get(5));
    deleteEdge(TABLES.get(4), TABLES.get(8));
    deleteEdge(TABLES.get(5), TABLES.get(6));
    deleteEdge(TABLES.get(6), TABLES.get(7));
    lineage = getLineage(Entity.TABLE, TABLES.get(4).getId(), 2, 2, adminAuthHeaders());
    assertTrue(lineage.getUpstreamEdges().isEmpty());
    assertTrue(lineage.getDownstreamEdges().isEmpty());
  }

  public Edge getEdge(Table from, Table to) {
    return getEdge(from.getId(), to.getId());
  }

  public static Edge getEdge(UUID from, UUID to) {
    return new Edge().withFromEntity(from).withToEntity(to);
  }

  public void addEdge(Table from, Table to) throws HttpResponseException {
    EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(new TableEntityInterface(from).getEntityReference())
            .withToEntity(new TableEntityInterface(to).getEntityReference());
    AddLineage addLineage = new AddLineage().withEdge(edge);
    addLineageAndCheck(addLineage, adminAuthHeaders());
  }

  public void deleteEdge(Table from, Table to) throws HttpResponseException {
    EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(new TableEntityInterface(from).getEntityReference())
            .withToEntity(new TableEntityInterface(to).getEntityReference());
    deleteLineageAndCheck(edge, adminAuthHeaders());
  }

  public static void addLineageAndCheck(AddLineage addLineage, Map<String, String> authHeaders)
      throws HttpResponseException {
    addLineage(addLineage, authHeaders);
    validateLineage(addLineage, authHeaders);
  }

  public static void deleteLineageAndCheck(EntitiesEdge deleteEdge, Map<String, String> authHeaders)
      throws HttpResponseException {
    deleteLineage(deleteEdge, authHeaders);
    validateLineageDeleted(deleteEdge, authHeaders);
  }

  public static void addLineage(AddLineage addLineage, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.put(getResource("lineage"), addLineage, Status.OK, authHeaders);
  }

  public static void deleteLineage(EntitiesEdge edge, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format(
                "lineage/%s/%s/%s/%s",
                edge.getFromEntity().getType(),
                edge.getFromEntity().getId(),
                edge.getToEntity().getType(),
                edge.getToEntity().getId()));
    TestUtils.delete(target, authHeaders);
  }

  private static void validateLineage(AddLineage addLineage, Map<String, String> authHeaders)
      throws HttpResponseException {
    EntityReference from = addLineage.getEdge().getFromEntity();
    EntityReference to = addLineage.getEdge().getToEntity();
    Edge expectedEdge = getEdge(from.getId(), to.getId());

    // Check fromEntity ---> toEntity downstream edge is returned
    EntityLineage lineage = getLineage(from.getType(), from.getId(), 0, 1, authHeaders);
    assertEdge(lineage, expectedEdge, true);

    // Check fromEntity ---> toEntity upstream edge is returned
    lineage = getLineage(to.getType(), to.getId(), 1, 0, authHeaders);
    assertEdge(lineage, expectedEdge, false);
  }

  private static void validateLineageDeleted(EntitiesEdge deletedEdge, Map<String, String> authHeaders)
      throws HttpResponseException {
    EntityReference from = deletedEdge.getFromEntity();
    EntityReference to = deletedEdge.getToEntity();
    Edge expectedEdge = getEdge(from.getId(), to.getId());

    // Check fromEntity ---> toEntity downstream edge is returned
    EntityLineage lineage = getLineage(from.getType(), from.getId(), 0, 1, authHeaders);
    assertDeleted(lineage, expectedEdge, true);

    // Check fromEntity ---> toEntity upstream edge is returned
    lineage = getLineage(to.getType(), to.getId(), 1, 0, authHeaders);
    assertDeleted(lineage, expectedEdge, false);
  }

  private static void validateLineage(EntityLineage lineage) {
    TestUtils.validateEntityReference(lineage.getEntity());
    lineage.getNodes().forEach(TestUtils::validateEntityReference);

    // Total number of from and to points in an edge must be equal to the number of nodes
    List<UUID> ids = new ArrayList<>();
    lineage
        .getUpstreamEdges()
        .forEach(
            edge -> {
              ids.add(edge.getFromEntity());
              ids.add(edge.getToEntity());
            });
    lineage
        .getDownstreamEdges()
        .forEach(
            edge -> {
              ids.add(edge.getFromEntity());
              ids.add(edge.getToEntity());
            });
    if (lineage.getNodes().size() != 0) {
      assertEquals((int) ids.stream().distinct().count(), lineage.getNodes().size() + 1);
    }
  }

  public static EntityLineage getLineage(
      String entity, UUID id, Integer upstreamDepth, Integer downStreamDepth, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/" + entity + "/" + id);
    target = upstreamDepth != null ? target.queryParam("upstreamDepth", upstreamDepth) : target;
    target = downStreamDepth != null ? target.queryParam("downstreamDepth", downStreamDepth) : target;
    EntityLineage lineage = TestUtils.get(target, EntityLineage.class, authHeaders);
    validateLineage((lineage));
    return lineage;
  }

  public static EntityLineage getLineageByName(
      String entity, String fqn, Integer upstreamDepth, Integer downStreamDepth, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/" + entity + "/name/" + fqn);
    target = upstreamDepth != null ? target.queryParam("upstreamDepth", upstreamDepth) : target;
    target = downStreamDepth != null ? target.queryParam("downstreamDepth", downStreamDepth) : target;
    EntityLineage lineage = TestUtils.get(target, EntityLineage.class, authHeaders);
    validateLineage((lineage));
    return lineage;
  }

  public static void assertEdge(EntityLineage lineage, Edge expectedEdge, boolean downstream) {
    if (downstream) {
      assertTrue(lineage.getDownstreamEdges().contains(expectedEdge));
    } else {
      assertTrue(lineage.getUpstreamEdges().contains(expectedEdge));
    }
  }

  public static void assertDeleted(EntityLineage lineage, Edge expectedEdge, boolean downstream) {
    if (downstream) {
      assertFalse(lineage.getDownstreamEdges().contains(expectedEdge));
    } else {
      assertFalse(lineage.getUpstreamEdges().contains(expectedEdge));
    }
  }

  public static void assertEdges(EntityLineage lineage, Edge[] expectedUpstreamEdges, Edge[] expectedDownstreamEdges) {
    assertEquals(lineage.getUpstreamEdges().size(), expectedUpstreamEdges.length);
    for (Edge expectedUpstreamEdge : expectedUpstreamEdges) {
      assertTrue(lineage.getUpstreamEdges().contains(expectedUpstreamEdge));
    }
    assertEquals(lineage.getDownstreamEdges().size(), expectedDownstreamEdges.length);
    for (Edge expectedDownstreamEdge : expectedDownstreamEdges) {
      assertTrue(lineage.getDownstreamEdges().contains(expectedDownstreamEdge));
    }
  }
}
