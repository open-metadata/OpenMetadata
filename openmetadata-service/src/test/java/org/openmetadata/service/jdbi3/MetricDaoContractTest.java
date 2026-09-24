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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.lang.reflect.Method;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MetricDaoContractTest {

  @Test
  void hierarchySqlHasEquivalentMysqlAndPostgresDisplayNameSearch() throws Exception {
    Method listHierarchy =
        CollectionDAO.MetricDAO.class.getDeclaredMethod(
            "listHierarchy", int.class, int.class, String.class, int.class, int.class);
    Map<ConnectionType, ConnectionAwareSqlQuery> queries = queriesByDialect(listHierarchy);

    assertEquals(2, queries.size());
    assertTrue(queries.get(MYSQL).value().contains("JSON_EXTRACT(member.json, '$.displayName')"));
    assertTrue(queries.get(POSTGRES).value().contains("member.json ->> 'displayName'"));
    queries
        .values()
        .forEach(
            query -> {
              assertTrue(query.value().contains("LIMIT :limit OFFSET :offset"));
              assertTrue(query.value().contains("JOIN metric_group_entity active_group"));
              assertTrue(query.value().contains("active_group.deleted = FALSE"));
              assertTrue(query.value().contains("child_rel.deleted = FALSE"));
              assertTrue(query.value().contains("group_member.deleted = FALSE"));
              assertTrue(query.value().contains("parent_rel.deleted = FALSE"));
              assertTrue(query.value().contains("group_rel.deleted = FALSE"));
            });
  }

  @Test
  void groupAssignmentLocksMetricsInStableOrder() throws Exception {
    Method lock =
        CollectionDAO.MetricDAO.class.getDeclaredMethod(
            "lockForGroupAssignment", java.util.List.class);
    String query = lock.getAnnotation(SqlQuery.class).value();

    assertTrue(query.contains("ORDER BY id FOR UPDATE"));
    assertTrue(query.contains("id IN (<metricIds>)"));
  }

  @Test
  void singleMetricGroupLookupFiltersSoftDeletedGroupsInSql() throws Exception {
    Method lookup =
        CollectionDAO.MetricDAO.class.getDeclaredMethod("findActiveGroupId", UUID.class, int.class);
    String query = lookup.getAnnotation(SqlQuery.class).value();

    assertTrue(query.contains("JOIN metric_group_entity"));
    assertTrue(query.contains("mg.deleted = FALSE"));
    assertTrue(query.contains("er.deleted = FALSE"));
  }

  @Test
  void batchMetricGroupLookupFiltersSoftDeletedGroupsInSql() throws Exception {
    Method lookup =
        CollectionDAO.MetricDAO.class.getDeclaredMethod(
            "findActiveGroupsInternal", java.util.List.class, int.class);
    String query = lookup.getAnnotation(SqlQuery.class).value();

    assertTrue(query.contains("JOIN metric_group_entity"));
    assertTrue(query.contains("mg.deleted = FALSE"));
    assertTrue(query.contains("er.deleted = FALSE"));
    assertTrue(query.contains("er.toId IN (<metricIds>)"));
  }

  @Test
  void childrenCountQueriesExcludeSoftDeletedMetricsForSingleAndBatchHydration() throws Exception {
    Method single =
        CollectionDAO.EntityRelationshipDAO.class.getDeclaredMethod(
            "countNonDeletedChildMetrics", UUID.class, int.class);
    Method batch =
        CollectionDAO.EntityRelationshipDAO.class.getDeclaredMethod(
            "countNonDeletedChildMetricsBatch", java.util.List.class, int.class);
    String singleQuery = single.getAnnotation(SqlQuery.class).value();
    String batchQuery = batch.getAnnotation(SqlQuery.class).value();

    assertTrue(singleQuery.contains("JOIN metric_entity me ON er.toId = me.id"));
    assertTrue(singleQuery.contains("er.fromEntity = 'metric'"));
    assertTrue(singleQuery.contains("er.toEntity = 'metric'"));
    assertTrue(singleQuery.contains("er.deleted = FALSE"));
    assertTrue(singleQuery.contains("me.deleted = false OR me.deleted IS NULL"));
    assertTrue(batchQuery.contains("JOIN metric_entity me ON er.toId = me.id"));
    assertTrue(batchQuery.contains("er.fromId IN (<fromIds>)"));
    assertTrue(batchQuery.contains("er.deleted = FALSE"));
    assertTrue(batchQuery.contains("me.deleted = false OR me.deleted IS NULL"));
    assertTrue(batchQuery.contains("GROUP BY er.fromId"));
  }

  @Test
  void groupMembershipListAndCountUseTheSameDialectSpecificSearchPredicate() throws Exception {
    Method listMembers =
        CollectionDAO.MetricGroupDAO.class.getDeclaredMethod(
            "listMemberJsons", UUID.class, int.class, String.class, int.class, int.class);
    Method countMembers =
        CollectionDAO.MetricGroupDAO.class.getDeclaredMethod(
            "countMembers", UUID.class, int.class, String.class);
    Map<ConnectionType, ConnectionAwareSqlQuery> listQueries = queriesByDialect(listMembers);
    Map<ConnectionType, ConnectionAwareSqlQuery> countQueries = queriesByDialect(countMembers);

    assertEquals(2, listQueries.size());
    assertEquals(2, countQueries.size());
    listQueries
        .values()
        .forEach(
            query -> {
              assertTrue(query.value().contains("SELECT me.json"));
              assertTrue(query.value().contains("er.deleted = FALSE"));
            });
    countQueries
        .values()
        .forEach(query -> assertTrue(query.value().contains("er.deleted = FALSE")));
    assertTrue(
        listQueries.get(MYSQL).value().contains(CollectionDAO.MetricGroupDAO.MEMBER_MATCH_MYSQL));
    assertTrue(
        countQueries.get(MYSQL).value().contains(CollectionDAO.MetricGroupDAO.MEMBER_MATCH_MYSQL));
    assertTrue(
        listQueries
            .get(POSTGRES)
            .value()
            .contains(CollectionDAO.MetricGroupDAO.MEMBER_MATCH_POSTGRES));
    assertTrue(
        countQueries
            .get(POSTGRES)
            .value()
            .contains(CollectionDAO.MetricGroupDAO.MEMBER_MATCH_POSTGRES));
  }

  @Test
  void metricHierarchyListFilterUsesRelationshipIdsInsteadOfFqnPrefixes() {
    UUID parentId = UUID.randomUUID();
    ListFilter parent = new ListFilter().addQueryParam("parentMetricId", parentId.toString());
    ListFilter roots = new ListFilter().addQueryParam("rootMetrics", "true");

    String parentCondition = CollectionDAO.MetricDAO.addHierarchyCondition(parent, "WHERE TRUE");
    String rootCondition = CollectionDAO.MetricDAO.addHierarchyCondition(roots, "WHERE TRUE");

    assertTrue(parentCondition.contains("er.fromId = :parentMetricId"));
    assertTrue(parentCondition.contains("er.relation = " + Relationship.CONTAINS.ordinal()));
    assertTrue(parentCondition.contains("er.deleted = FALSE"));
    assertTrue(rootCondition.contains("NOT EXISTS"));
    assertTrue(rootCondition.contains("er.toId = metric_entity.id"));
    assertTrue(rootCondition.contains("er.deleted = FALSE"));
  }

  @Test
  void metricRelationshipQueriesExcludeInactiveEdges() throws Exception {
    List<String> queries =
        List.of(
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "countNonDeletedChildMetrics",
                UUID.class,
                int.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "countNonDeletedChildMetricsBatch",
                List.class,
                int.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "countFindTo",
                UUID.class,
                String.class,
                List.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "findToWithOffset",
                UUID.class,
                String.class,
                List.class,
                int.class,
                int.class),
            sqlQuery(
                CollectionDAO.MetricDAO.class,
                "listChildIds",
                UUID.class,
                int.class,
                int.class,
                int.class),
            sqlQuery(CollectionDAO.MetricDAO.class, "listDescendantSeedIds", UUID.class, int.class),
            sqlQuery(
                CollectionDAO.MetricDAO.class,
                "findUpstreamAssetIds",
                UUID.class,
                List.class,
                int.class),
            sqlQuery(
                CollectionDAO.MetricDAO.class,
                "findDownstreamAssetIds",
                UUID.class,
                List.class,
                int.class));

    queries.forEach(query -> assertTrue(query.contains("deleted = FALSE"), query));
  }

  @Test
  void singleRelationshipLookupsMatchActiveBatchLookupSemantics() throws Exception {
    List<String> queries =
        List.of(
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "findTo",
                UUID.class,
                String.class,
                List.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "findTo",
                UUID.class,
                String.class,
                int.class,
                String.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "findFrom",
                UUID.class,
                String.class,
                int.class,
                String.class),
            sqlQuery(
                CollectionDAO.EntityRelationshipDAO.class,
                "findFrom",
                UUID.class,
                String.class,
                int.class));

    queries.forEach(query -> assertTrue(query.contains("deleted = FALSE"), query));
  }

  @Test
  void metricGroupMembershipQueriesExcludeInactiveEdges() throws Exception {
    List<String> queries =
        List.of(
            sqlQuery(
                CollectionDAO.MetricGroupDAO.class,
                "listRootMemberIds",
                UUID.class,
                UUID.class,
                int.class,
                int.class,
                int.class,
                int.class),
            sqlQuery(
                CollectionDAO.MetricGroupDAO.class,
                "countRootMembers",
                UUID.class,
                UUID.class,
                int.class,
                int.class),
            sqlQuery(
                CollectionDAO.MetricGroupDAO.class,
                "countNonDeletedMembers",
                UUID.class,
                int.class),
            sqlQuery(
                CollectionDAO.MetricGroupDAO.class,
                "countNonDeletedMembersBatch",
                List.class,
                int.class));
    Method listRoots =
        CollectionDAO.MetricGroupDAO.class.getDeclaredMethod(
            "listRootMemberJsonsPage",
            UUID.class,
            int.class,
            int.class,
            String.class,
            int.class,
            int.class);
    Method countRoots =
        CollectionDAO.MetricGroupDAO.class.getDeclaredMethod(
            "countRootMembersPage", UUID.class, int.class, int.class, String.class);

    queries.forEach(query -> assertTrue(query.contains("deleted = FALSE"), query));
    queriesByDialect(listRoots)
        .values()
        .forEach(query -> assertTrue(query.value().contains("deleted = FALSE")));
    queriesByDialect(countRoots)
        .values()
        .forEach(query -> assertTrue(query.value().contains("deleted = FALSE")));
  }

  @Test
  void hierarchyRowMapperPreservesTypedIds() throws Exception {
    UUID id = UUID.randomUUID();
    ResultSet resultSet = mock(ResultSet.class);
    when(resultSet.getString("hierarchy_id")).thenReturn(id.toString());
    when(resultSet.getString("entity_type")).thenReturn("metricGroup");

    CollectionDAO.MetricDAO.HierarchyRow row =
        new CollectionDAO.MetricDAO.HierarchyRowMapper().map(resultSet, null);

    assertEquals(id, row.id());
    assertEquals("metricGroup", row.entityType());
  }

  private Map<ConnectionType, ConnectionAwareSqlQuery> queriesByDialect(Method method) {
    return Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlQuery.class))
        .collect(Collectors.toMap(ConnectionAwareSqlQuery::connectionType, Function.identity()));
  }

  private String sqlQuery(Class<?> dao, String methodName, Class<?>... parameterTypes)
      throws Exception {
    return dao.getDeclaredMethod(methodName, parameterTypes).getAnnotation(SqlQuery.class).value();
  }
}
