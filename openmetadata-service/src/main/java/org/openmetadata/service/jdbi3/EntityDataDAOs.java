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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Relationship.CONTAINS;
import static org.openmetadata.schema.type.Relationship.MENTIONED_IN;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.statement.UseRowMapper;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipCount;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface EntityDataDAOs {
  @CreateSqlObject
  TableDAO tableDAO();

  @CreateSqlObject
  QueryDAO queryDAO();

  @CreateSqlObject
  MetricDAO metricDAO();

  @CreateSqlObject
  MetricGroupDAO metricGroupDAO();

  @CreateSqlObject
  ChartDAO chartDAO();

  @CreateSqlObject
  ApplicationDAO applicationDAO();

  @CreateSqlObject
  ApplicationMarketPlaceDAO applicationMarketPlaceDAO();

  @CreateSqlObject
  PipelineDAO pipelineDAO();

  @CreateSqlObject
  ReportDAO reportDAO();

  @CreateSqlObject
  MlModelDAO mlModelDAO();

  @CreateSqlObject
  GlossaryDAO glossaryDAO();

  @CreateSqlObject
  GlossaryTermDAO glossaryTermDAO();

  @CreateSqlObject
  BotDAO botDAO();

  @CreateSqlObject
  PolicyDAO policyDAO();

  @CreateSqlObject
  IngestionPipelineDAO ingestionPipelineDAO();

  @CreateSqlObject
  PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  MlModelServiceDAO mlModelServiceDAO();

  @CreateSqlObject
  MessagingServiceDAO messagingServiceDAO();

  @CreateSqlObject
  StoredProcedureDAO storedProcedureDAO();

  interface BotDAO extends EntityDAO<Bot> {
    @Override
    default String getTableName() {
      return "bot_entity";
    }

    @Override
    default Class<Bot> getEntityClass() {
      return Bot.class;
    }
  }

  interface ChartDAO extends EntityDAO<Chart> {
    @Override
    default String getTableName() {
      return "chart_entity";
    }

    @Override
    default Class<Chart> getEntityClass() {
      return Chart.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface ApplicationDAO extends EntityDAO<App> {
    @Override
    default String getTableName() {
      return "installed_apps";
    }

    @Override
    default Class<App> getEntityClass() {
      return App.class;
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) as displayName from installed_apps",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT id, name, json ->> 'displayName' as displayName from installed_apps",
        connectionType = POSTGRES)
    @RegisterRowMapper(AppEntityReferenceMapper.class)
    List<EntityReference> listAppsRef();

    class AppEntityReferenceMapper implements RowMapper<EntityReference> {
      @Override
      public EntityReference map(ResultSet rs, StatementContext ctx) throws SQLException {
        String fqn = rs.getString("name");
        String displayName = rs.getString("displayName");

        return new EntityReference()
            .withId(UUID.fromString(rs.getString("id")))
            .withName(fqn)
            .withDisplayName(displayName)
            .withFullyQualifiedName(fqn)
            .withType(APPLICATION);
      }
    }
  }

  interface ApplicationMarketPlaceDAO extends EntityDAO<AppMarketPlaceDefinition> {
    @Override
    default String getTableName() {
      return "apps_marketplace";
    }

    @Override
    default Class<AppMarketPlaceDefinition> getEntityClass() {
      return AppMarketPlaceDefinition.class;
    }
  }

  interface MessagingServiceDAO extends EntityDAO<MessagingService> {
    @Override
    default String getTableName() {
      return "messaging_service_entity";
    }

    @Override
    default Class<MessagingService> getEntityClass() {
      return MessagingService.class;
    }
  }

  interface MetricGroupDAO extends EntityDAO<MetricGroup> {
    String MEMBER_MATCH_MYSQL =
        "(LOWER(me.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(me.json, '$.displayName')), '')) "
            + "LIKE :nameLike ESCAPE '!')";
    String MEMBER_MATCH_POSTGRES =
        "(LOWER(me.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(me.json ->> 'displayName', '')) LIKE :nameLike ESCAPE '!')";

    @Override
    default String getTableName() {
      return "metric_group_entity";
    }

    @Override
    default Class<MetricGroup> getEntityClass() {
      return MetricGroup.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT me.json FROM entity_relationship er "
                + "JOIN metric_entity me ON me.id = er.toId "
                + "WHERE er.fromId = :groupId AND er.fromEntity = 'metricGroup' "
                + "AND er.toEntity = 'metric' AND er.relation = :relation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_MYSQL
                + " ORDER BY me.name, me.id LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT me.json FROM entity_relationship er "
                + "JOIN metric_entity me ON me.id = er.toId "
                + "WHERE er.fromId = :groupId AND er.fromEntity = 'metricGroup' "
                + "AND er.toEntity = 'metric' AND er.relation = :relation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_POSTGRES
                + " ORDER BY me.name, me.id LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    List<String> listMemberJsons(
        @BindUUID("groupId") UUID groupId,
        @Bind("relation") int relation,
        @Bind("nameLike") String nameLike,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM entity_relationship er "
                + "JOIN metric_entity me ON me.id = er.toId "
                + "WHERE er.fromId = :groupId AND er.fromEntity = 'metricGroup' "
                + "AND er.toEntity = 'metric' AND er.relation = :relation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_MYSQL,
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM entity_relationship er "
                + "JOIN metric_entity me ON me.id = er.toId "
                + "WHERE er.fromId = :groupId AND er.fromEntity = 'metricGroup' "
                + "AND er.toEntity = 'metric' AND er.relation = :relation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_POSTGRES,
        connectionType = POSTGRES)
    int countMembers(
        @BindUUID("groupId") UUID groupId,
        @Bind("relation") int relation,
        @Bind("nameLike") String nameLike);

    @SqlQuery(
        "SELECT me.id FROM entity_relationship group_rel "
            + "JOIN metric_entity me ON me.id = group_rel.toId "
            + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
            + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
            + "AND me.id <> :excludeId AND (me.deleted = FALSE OR me.deleted IS NULL) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
            + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
            + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
            + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset")
    List<String> listRootMemberIds(
        @BindUUID("groupId") UUID groupId,
        @BindUUID("excludeId") UUID excludeId,
        @Bind("hasRelation") int hasRelation,
        @Bind("containsRelation") int containsRelation,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlQuery(
        "SELECT COUNT(*) FROM entity_relationship group_rel "
            + "JOIN metric_entity me ON me.id = group_rel.toId "
            + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
            + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
            + "AND me.id <> :excludeId AND (me.deleted = FALSE OR me.deleted IS NULL) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
            + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
            + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation)")
    int countRootMembers(
        @BindUUID("groupId") UUID groupId,
        @BindUUID("excludeId") UUID excludeId,
        @Bind("hasRelation") int hasRelation,
        @Bind("containsRelation") int containsRelation);

    @SqlQuery(
        "SELECT COUNT(*) FROM entity_relationship er "
            + "JOIN metric_entity me ON me.id = er.toId "
            + "WHERE er.fromId = :groupId AND er.fromEntity = 'metricGroup' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation "
            + "AND (me.deleted = FALSE OR me.deleted IS NULL)")
    int countNonDeletedMembers(@BindUUID("groupId") UUID groupId, @Bind("relation") int relation);

    @SqlQuery(
        "SELECT er.fromId, COUNT(er.toId) FROM entity_relationship er "
            + "JOIN metric_entity me ON me.id = er.toId "
            + "WHERE er.fromId IN (<groupIds>) AND er.fromEntity = 'metricGroup' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation "
            + "AND (me.deleted = FALSE OR me.deleted IS NULL) GROUP BY er.fromId")
    @RegisterRowMapper(EntityRelationshipDAO.ToRelationshipCountMapper.class)
    List<EntityRelationshipCount> countNonDeletedMembersBatch(
        @BindList("groupIds") List<String> groupIds, @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT me.json FROM entity_relationship group_rel "
                + "JOIN metric_entity me ON me.id = group_rel.toId "
                + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
                + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_MYSQL
                + " AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
                + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
                + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
                + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT me.json FROM entity_relationship group_rel "
                + "JOIN metric_entity me ON me.id = group_rel.toId "
                + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
                + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_POSTGRES
                + " AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
                + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
                + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
                + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    List<String> listRootMemberJsonsPage(
        @BindUUID("groupId") UUID groupId,
        @Bind("hasRelation") int hasRelation,
        @Bind("containsRelation") int containsRelation,
        @Bind("nameLike") String nameLike,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM entity_relationship group_rel "
                + "JOIN metric_entity me ON me.id = group_rel.toId "
                + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
                + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_MYSQL
                + " AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
                + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
                + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM entity_relationship group_rel "
                + "JOIN metric_entity me ON me.id = group_rel.toId "
                + "WHERE group_rel.fromId = :groupId AND group_rel.fromEntity = 'metricGroup' "
                + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
                + "AND (me.deleted = FALSE OR me.deleted IS NULL) AND "
                + MEMBER_MATCH_POSTGRES
                + " AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
                + "WHERE parent_rel.toId = me.id AND parent_rel.fromEntity = 'metric' "
                + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation)",
        connectionType = POSTGRES)
    int countRootMembersPage(
        @BindUUID("groupId") UUID groupId,
        @Bind("hasRelation") int hasRelation,
        @Bind("containsRelation") int containsRelation,
        @Bind("nameLike") String nameLike);
  }

  interface MetricDAO extends EntityDAO<Metric> {
    String HIERARCHY_CTE =
        "WITH RECURSIVE metric_tree(root_id, member_id) AS ("
            + "SELECT root.id, root.id FROM metric_entity root "
            + "WHERE (root.deleted = FALSE OR root.deleted IS NULL) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
            + "WHERE parent_rel.toId = root.id AND parent_rel.fromEntity = 'metric' "
            + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
            + "UNION SELECT tree.root_id, child.id FROM metric_tree tree "
            + "JOIN entity_relationship child_rel ON child_rel.fromId = tree.member_id "
            + "AND child_rel.fromEntity = 'metric' AND child_rel.toEntity = 'metric' "
            + "AND child_rel.relation = :containsRelation "
            + "JOIN metric_entity child ON child.id = child_rel.toId "
            + "WHERE (child.deleted = FALSE OR child.deleted IS NULL)) ";
    String HIERARCHY_GROUP_MEMBER_EXISTS =
        " OR EXISTS (SELECT 1 FROM entity_relationship group_member "
            + "JOIN metric_entity member ON member.id = group_member.toId "
            + "WHERE group_member.fromId = mg.id AND group_member.fromEntity = 'metricGroup' "
            + "AND group_member.toEntity = 'metric' AND group_member.relation = :hasRelation "
            + "AND (member.deleted = FALSE OR member.deleted IS NULL) AND ";
    String HIERARCHY_STANDALONE_ROOT =
        " UNION ALL SELECT m.id AS hierarchy_id, m.name AS hierarchy_name, "
            + "'metric' AS entity_type FROM metric_entity m "
            + "WHERE (m.deleted = FALSE OR m.deleted IS NULL) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
            + "WHERE parent_rel.toId = m.id AND parent_rel.fromEntity = 'metric' "
            + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship group_rel "
            + "JOIN metric_group_entity active_group ON active_group.id = group_rel.fromId "
            + "WHERE group_rel.toId = m.id AND group_rel.fromEntity = 'metricGroup' "
            + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
            + "AND (active_group.deleted = FALSE OR active_group.deleted IS NULL)) "
            + "AND EXISTS (SELECT 1 FROM metric_tree tree "
            + "JOIN metric_entity member ON member.id = tree.member_id "
            + "WHERE tree.root_id = m.id AND ";
    String HIERARCHY_STANDALONE_ROOT_COUNT =
        " UNION ALL SELECT m.id AS hierarchy_id FROM metric_entity m "
            + "WHERE (m.deleted = FALSE OR m.deleted IS NULL) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship parent_rel "
            + "WHERE parent_rel.toId = m.id AND parent_rel.fromEntity = 'metric' "
            + "AND parent_rel.toEntity = 'metric' AND parent_rel.relation = :containsRelation) "
            + "AND NOT EXISTS (SELECT 1 FROM entity_relationship group_rel "
            + "JOIN metric_group_entity active_group ON active_group.id = group_rel.fromId "
            + "WHERE group_rel.toId = m.id AND group_rel.fromEntity = 'metricGroup' "
            + "AND group_rel.toEntity = 'metric' AND group_rel.relation = :hasRelation "
            + "AND (active_group.deleted = FALSE OR active_group.deleted IS NULL)) "
            + "AND EXISTS (SELECT 1 FROM metric_tree tree "
            + "JOIN metric_entity member ON member.id = tree.member_id "
            + "WHERE tree.root_id = m.id AND ";
    String HIERARCHY_GROUP_MATCH_MYSQL =
        "(LOWER(mg.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(mg.json, '$.displayName')), '')) "
            + "LIKE :nameLike ESCAPE '!')";
    String HIERARCHY_GROUP_MATCH_POSTGRES =
        "(LOWER(mg.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(mg.json ->> 'displayName', '')) LIKE :nameLike ESCAPE '!')";
    String HIERARCHY_MEMBER_MATCH_MYSQL =
        "(LOWER(member.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(member.json, '$.displayName')), '')) "
            + "LIKE :nameLike ESCAPE '!')";
    String HIERARCHY_MEMBER_MATCH_POSTGRES =
        "(LOWER(member.name) LIKE :nameLike ESCAPE '!' "
            + "OR LOWER(COALESCE(member.json ->> 'displayName', '')) LIKE :nameLike ESCAPE '!')";

    record HierarchyRow(UUID id, String entityType) {}

    @SqlQuery("SELECT id FROM metric_entity WHERE id IN (<metricIds>) ORDER BY id FOR UPDATE")
    List<String> lockForGroupAssignment(@BindList("metricIds") List<String> metricIds);

    @SqlQuery(
        "SELECT mg.id FROM entity_relationship er "
            + "JOIN metric_group_entity mg ON mg.id = er.fromId "
            + "WHERE er.toId = :metricId AND er.fromEntity = 'metricGroup' "
            + "AND er.toEntity = 'metric' AND er.relation = :hasRelation "
            + "AND (mg.deleted = FALSE OR mg.deleted IS NULL) LIMIT 1")
    String findActiveGroupId(
        @BindUUID("metricId") UUID metricId, @Bind("hasRelation") int hasRelation);

    @SqlQuery(
        "SELECT er.fromId, er.toId, er.fromEntity, er.toEntity, er.relation, er.json, er.jsonSchema "
            + "FROM entity_relationship er "
            + "JOIN metric_group_entity mg ON mg.id = er.fromId "
            + "WHERE er.toId IN (<metricIds>) AND er.fromEntity = 'metricGroup' "
            + "AND er.toEntity = 'metric' AND er.relation = :hasRelation "
            + "AND er.deleted = FALSE AND (mg.deleted = FALSE OR mg.deleted IS NULL)")
    @UseRowMapper(EntityRelationshipDAO.RelationshipObjectMapper.class)
    List<EntityRelationshipObject> findActiveGroupsInternal(
        @BindList("metricIds") List<String> metricIds, @Bind("hasRelation") int hasRelation);

    default List<EntityRelationshipObject> findActiveGroups(
        List<String> metricIds, int hasRelation) {
      return EntityDAO.queryInChunks(
          metricIds, chunk -> findActiveGroupsInternal(chunk, hasRelation));
    }

    class HierarchyRowMapper implements RowMapper<HierarchyRow> {
      @Override
      public HierarchyRow map(ResultSet resultSet, StatementContext context) throws SQLException {
        return new HierarchyRow(
            UUID.fromString(resultSet.getString("hierarchy_id")),
            resultSet.getString("entity_type"));
      }
    }

    @Override
    default String getTableName() {
      return "metric_entity";
    }

    @Override
    default Class<Metric> getEntityClass() {
      return Metric.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            HIERARCHY_CTE
                + "SELECT hierarchy_id, entity_type FROM ("
                + "SELECT mg.id AS hierarchy_id, mg.name AS hierarchy_name, 'metricGroup' AS entity_type "
                + "FROM metric_group_entity mg WHERE (mg.deleted = FALSE OR mg.deleted IS NULL) "
                + "AND ("
                + HIERARCHY_GROUP_MATCH_MYSQL
                + HIERARCHY_GROUP_MEMBER_EXISTS
                + HIERARCHY_MEMBER_MATCH_MYSQL
                + "))"
                + HIERARCHY_STANDALONE_ROOT
                + HIERARCHY_MEMBER_MATCH_MYSQL
                + ")) hierarchy_items "
                + "ORDER BY hierarchy_name, entity_type, hierarchy_id LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            HIERARCHY_CTE
                + "SELECT hierarchy_id, entity_type FROM ("
                + "SELECT mg.id AS hierarchy_id, mg.name AS hierarchy_name, 'metricGroup' AS entity_type "
                + "FROM metric_group_entity mg WHERE (mg.deleted = FALSE OR mg.deleted IS NULL) "
                + "AND ("
                + HIERARCHY_GROUP_MATCH_POSTGRES
                + HIERARCHY_GROUP_MEMBER_EXISTS
                + HIERARCHY_MEMBER_MATCH_POSTGRES
                + "))"
                + HIERARCHY_STANDALONE_ROOT
                + HIERARCHY_MEMBER_MATCH_POSTGRES
                + ")) hierarchy_items "
                + "ORDER BY hierarchy_name, entity_type, hierarchy_id LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    @RegisterRowMapper(HierarchyRowMapper.class)
    List<HierarchyRow> listHierarchy(
        @Bind("containsRelation") int containsRelation,
        @Bind("hasRelation") int hasRelation,
        @Bind("nameLike") String nameLike,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            HIERARCHY_CTE
                + "SELECT COUNT(*) FROM ("
                + "SELECT mg.id AS hierarchy_id FROM metric_group_entity mg "
                + "WHERE (mg.deleted = FALSE OR mg.deleted IS NULL) "
                + "AND ("
                + HIERARCHY_GROUP_MATCH_MYSQL
                + HIERARCHY_GROUP_MEMBER_EXISTS
                + HIERARCHY_MEMBER_MATCH_MYSQL
                + "))"
                + HIERARCHY_STANDALONE_ROOT_COUNT
                + HIERARCHY_MEMBER_MATCH_MYSQL
                + ")) hierarchy_items",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            HIERARCHY_CTE
                + "SELECT COUNT(*) FROM ("
                + "SELECT mg.id AS hierarchy_id FROM metric_group_entity mg "
                + "WHERE (mg.deleted = FALSE OR mg.deleted IS NULL) "
                + "AND ("
                + HIERARCHY_GROUP_MATCH_POSTGRES
                + HIERARCHY_GROUP_MEMBER_EXISTS
                + HIERARCHY_MEMBER_MATCH_POSTGRES
                + "))"
                + HIERARCHY_STANDALONE_ROOT_COUNT
                + HIERARCHY_MEMBER_MATCH_POSTGRES
                + ")) hierarchy_items",
        connectionType = POSTGRES)
    int countHierarchy(
        @Bind("containsRelation") int containsRelation,
        @Bind("hasRelation") int hasRelation,
        @Bind("nameLike") String nameLike);

    @SqlQuery(
        "SELECT me.id FROM entity_relationship er "
            + "JOIN metric_entity me ON me.id = er.toId "
            + "WHERE er.fromId = :parentId AND er.fromEntity = 'metric' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation "
            + "AND (me.deleted = FALSE OR me.deleted IS NULL) "
            + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset")
    List<String> listChildIds(
        @BindUUID("parentId") UUID parentId,
        @Bind("relation") int relation,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlQuery(
        "SELECT me.id FROM entity_relationship er "
            + "JOIN metric_entity me ON me.id = er.toId "
            + "WHERE er.fromId = :parentId AND er.fromEntity = 'metric' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation "
            + "AND me.id <> :excludeId AND (me.deleted = FALSE OR me.deleted IS NULL) "
            + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset")
    List<String> listSiblingIds(
        @BindUUID("parentId") UUID parentId,
        @BindUUID("excludeId") UUID excludeId,
        @Bind("relation") int relation,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @SqlQuery(
        "SELECT COUNT(*) FROM entity_relationship er "
            + "JOIN metric_entity me ON me.id = er.toId "
            + "WHERE er.fromId = :parentId AND er.fromEntity = 'metric' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation "
            + "AND me.id <> :excludeId AND (me.deleted = FALSE OR me.deleted IS NULL)")
    int countSiblings(
        @BindUUID("parentId") UUID parentId,
        @BindUUID("excludeId") UUID excludeId,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT er.toId FROM entity_relationship er "
            + "WHERE er.fromId = :parentId AND er.fromEntity = 'metric' "
            + "AND er.toEntity = 'metric' AND er.relation = :relation")
    List<String> listDescendantSeedIds(
        @BindUUID("parentId") UUID parentId, @Bind("relation") int relation);

    @SqlQuery(
        "SELECT me.id FROM metric_entity me "
            + "WHERE me.id IN (<ids>) AND (me.deleted = FALSE OR me.deleted IS NULL) "
            + "ORDER BY me.name, me.id LIMIT :limit OFFSET :offset")
    List<String> pageMetricIds(
        @BindList("ids") List<String> ids, @Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery(
        "SELECT fromId FROM entity_relationship WHERE toId = :metricId "
            + "AND toEntity = 'metric' AND fromId IN (<assetIds>) AND relation = :relation")
    List<String> findUpstreamAssetIds(
        @BindUUID("metricId") UUID metricId,
        @BindList("assetIds") List<String> assetIds,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT toId FROM entity_relationship WHERE fromId = :metricId "
            + "AND fromEntity = 'metric' AND toId IN (<assetIds>) AND relation = :relation")
    List<String> findDownstreamAssetIds(
        @BindUUID("metricId") UUID metricId,
        @BindList("assetIds") List<String> assetIds,
        @Bind("relation") int relation);

    /**
     * Metric fully qualified names are flat — a child metric's FQN is not prefixed by its parent's.
     * The generic {@code fqnHash LIKE 'parent.%'} hierarchy filtering used by domains and glossary
     * terms therefore cannot work here, so hierarchy listing walks the CONTAINS edges instead.
     * {@code parentMetricId} selects immediate children of one metric; {@code rootMetrics} selects
     * metrics that no other metric contains.
     */
    static String addHierarchyCondition(ListFilter filter, String condition) {
      String parentMetricId = filter.getQueryParam("parentMetricId");
      String rootMetrics = filter.getQueryParam("rootMetrics");
      String result = condition;
      if (!nullOrEmpty(parentMetricId)) {
        result +=
            " AND metric_entity.id IN (SELECT er.toId FROM entity_relationship er"
                + " WHERE er.fromId = :parentMetricId AND er.fromEntity = 'metric'"
                + " AND er.toEntity = 'metric' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      } else if (Boolean.TRUE.toString().equals(rootMetrics)) {
        result +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er"
                + " WHERE er.toId = metric_entity.id AND er.fromEntity = 'metric'"
                + " AND er.toEntity = 'metric' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }
      return result;
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = addHierarchyCondition(filter, filter.getCondition());
      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = addHierarchyCondition(filter, filter.getCondition());
      return listBefore(
          getTableName(), filter.getQueryParams(), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = addHierarchyCondition(filter, filter.getCondition());
      return listAfter(
          getTableName(), filter.getQueryParams(), condition, limit, afterName, afterId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, int offset) {
      String condition = addHierarchyCondition(filter, filter.getCondition());
      return listAfter(getTableName(), filter.getQueryParams(), condition, limit, offset);
    }

    @Override
    default CursorRow getCursorAtOffset(ListFilter filter, int offset) {
      String condition = addHierarchyCondition(filter, filter.getCondition());
      return getCursorAtOffset(getTableName(), filter.getQueryParams(), condition, offset);
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT DISTINCT customUnitOfMeasurement AS customUnit "
                + "FROM metric_entity "
                + "WHERE customUnitOfMeasurement IS NOT NULL "
                + "AND customUnitOfMeasurement != '' "
                + "AND deleted = false "
                + "ORDER BY customUnitOfMeasurement",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT DISTINCT customUnitOfMeasurement AS customUnit "
                + "FROM metric_entity "
                + "WHERE customUnitOfMeasurement IS NOT NULL "
                + "AND customUnitOfMeasurement != '' "
                + "AND deleted = false "
                + "ORDER BY customUnitOfMeasurement",
        connectionType = POSTGRES)
    List<String> getDistinctCustomUnitsOfMeasurement();
  }

  interface MlModelDAO extends EntityDAO<MlModel> {
    @Override
    default String getTableName() {
      return "ml_model_entity";
    }

    @Override
    default Class<MlModel> getEntityClass() {
      return MlModel.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface GlossaryDAO extends EntityDAO<Glossary> {
    @Override
    default String getTableName() {
      return "glossary_entity";
    }

    @Override
    default Class<Glossary> getEntityClass() {
      return Glossary.class;
    }
  }

  interface GlossaryTermDAO extends EntityDAO<GlossaryTerm> {
    @Override
    default String getTableName() {
      return "glossary_term_entity";
    }

    @Override
    default Class<GlossaryTerm> getEntityClass() {
      return GlossaryTerm.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }

      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }

      return listBefore(
          getTableName(), filter.getQueryParams(), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      }
      return listAfter(
          getTableName(), filter.getQueryParams(), condition, limit, afterName, afterId);
    }

    @SqlQuery("select json FROM glossary_term_entity where fqnhash LIKE :concatFqnhash ")
    List<String> getNestedTerms(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :concatFqnhash ")
    int countNestedTerms(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery(
        "SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName)")
    int getGlossaryTermCountIgnoreCase(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName);

    @SqlQuery(
        "SELECT COUNT(*) FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName) AND id != :excludeId")
    int getGlossaryTermCountIgnoreCaseExcludingId(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName,
        @Bind("excludeId") String excludeId);

    @SqlQuery(
        "SELECT json FROM glossary_term_entity WHERE fqnHash LIKE :glossaryHash AND LOWER(name) = LOWER(:termName)")
    String getGlossaryTermByNameAndGlossaryIgnoreCase(
        @BindConcat(
                value = "glossaryHash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash,
        @Bind("termName") String termName);

    // Search glossary terms by name and displayName using LIKE queries
    // The displayName column is a generated column added in migration 1.9.3
    // entityStatus filtering uses generated column added in migration 1.12.2
    @SqlQuery(
        "SELECT json FROM glossary_term_entity WHERE deleted = FALSE "
            + "AND fqnHash LIKE :parentHash "
            + "AND (LOWER(name) LIKE LOWER(:searchTerm) "
            + "OR LOWER(COALESCE(displayName, '')) LIKE LOWER(:searchTerm)) "
            + "<statusCondition> "
            + "ORDER BY name "
            + "LIMIT :limit OFFSET :offset")
    List<String> searchGlossaryTerms(
        @Bind("parentHash") String parentHash,
        @Bind("searchTerm") String searchTerm,
        @Define("statusCondition") String statusCondition,
        @Bind("limit") int limit,
        @Bind("offset") int offset);
  }

  interface IngestionPipelineDAO extends EntityDAO<IngestionPipeline> {
    @Override
    default String getTableName() {
      return "ingestion_pipeline_entity";
    }

    @Override
    default Class<IngestionPipeline> getEntityClass() {
      return IngestionPipeline.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    /**
     * A pipeline's service category is not a column on the pipeline row — it lives in {@code
     * entity_relationship.fromEntity} — so the {@code serviceType} filter has to be a join rather
     * than a {@link ListFilter} condition. Every listing that honours {@code serviceType} shares
     * this builder so ordered, unordered and count queries can never drift apart on which rows they
     * consider in scope.
     *
     * <p>Always call this before branching on {@code serviceType}: the condition getters register
     * derived bind parameters on the filter, and the non-serviceType path relies on them too.
     */
    default String serviceTypeJoinCondition(ListFilter filter) {
      StringBuilder condition =
          new StringBuilder(
              "INNER JOIN entity_relationship ON ingestion_pipeline_entity.id = entity_relationship.toId");

      if (filter.getQueryParam("pipelineType") != null) {
        condition.append(String.format(" and %s", filter.getPipelineTypeCondition(null)));
      }

      if (filter.getQueryParam("applicationType") != null) {
        condition.append(String.format(" and %s", filter.getApplicationTypeCondition()));
      }

      if (filter.getQueryParam("service") != null) {
        condition.append(String.format(" and %s", filter.getServiceCondition(null)));
      }

      if (filter.getQueryParam("provider") != null) {
        condition.append(String.format(" and %s", filter.getProviderCondition(getTableName())));
      }

      return condition
          .append(
              String.format(
                  " WHERE entity_relationship.fromEntity = :serviceType and entity_relationship.relation = %d",
                  CONTAINS.ordinal()))
          .toString();
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = serviceTypeJoinCondition(filter);
      if (nullOrEmpty(filter.getQueryParam("serviceType"))) {
        return EntityDAO.super.listCount(filter);
      }
      return listIngestionPipelineCount(condition, new HashMap<>(), filter.getQueryParams());
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = serviceTypeJoinCondition(filter);
      if (nullOrEmpty(filter.getQueryParam("serviceType"))) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      condition =
          String.format(
              "%s and (ingestion_pipeline_entity.name > :afterName OR (ingestion_pipeline_entity.name = :afterName AND ingestion_pipeline_entity.id > :afterId))  order by ingestion_pipeline_entity.name ASC,ingestion_pipeline_entity.id ASC LIMIT :limit",
              condition);

      Map<String, Object> bindMap = new HashMap<>();
      bindMap.put("afterName", afterName);
      bindMap.put("afterId", afterId);
      bindMap.put("limit", limit);
      return listAfterIngestionPipelineByserviceType(condition, bindMap, filter.getQueryParams());
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = serviceTypeJoinCondition(filter);
      if (nullOrEmpty(filter.getQueryParam("serviceType"))) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      condition =
          String.format(
              "%s and (ingestion_pipeline_entity.name < :beforeName OR (ingestion_pipeline_entity.name = :beforeName AND ingestion_pipeline_entity.id < :beforeId))  order by ingestion_pipeline_entity.name DESC, ingestion_pipeline_entity.id DESC LIMIT :limit",
              condition);

      Map<String, Object> bindMap = new HashMap<>();
      bindMap.put("beforeName", beforeName);
      bindMap.put("beforeId", beforeId);
      bindMap.put("limit", limit);
      return listBeforeIngestionPipelineByserviceType(condition, bindMap, filter.getQueryParams());
    }

    @SqlQuery("SELECT ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond>")
    List<String> listAfterIngestionPipelineByserviceType(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);

    @SqlQuery(
        "SELECT json FROM (SELECT ingestion_pipeline_entity.name, ingestion_pipeline_entity.id, ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond>) last_rows_subquery ORDER BY last_rows_subquery.name,last_rows_subquery.id")
    List<String> listBeforeIngestionPipelineByserviceType(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);

    @SqlQuery("SELECT count(*) FROM ingestion_pipeline_entity <cond> ")
    int listIngestionPipelineCount(
        @Define("cond") String cond,
        @BindMap Map<String, Object> bindings,
        @BindMap Map<String, String> params);

    /**
     * The {@code <cond>} every displayName-ordered query below is given: the same scope the
     * unordered listing uses, so ordering the list can never widen or narrow which rows it returns.
     * Columns stay table-qualified because the serviceType variant joins {@code
     * entity_relationship}, which has {@code json} and {@code deleted} columns of its own.
     */
    default String displayNameSortCondition(ListFilter filter) {
      // Unqualified: a table prefix on the pipelineType JSON expression reads as a routine call.
      return nullOrEmpty(filter.getQueryParam("serviceType"))
          ? filter.getCondition()
          : serviceTypeJoinCondition(filter);
    }

    /**
     * The SQL for the value the Name column renders — {@code displayName} falling back to {@code
     * name} — sorted inline. No generated column: the pipeline table is small enough (bounded by
     * services × pipeline types plus automations) that an unindexed sort is instant, and an
     * expression index can be added later without a schema change if a deployment ever grows.
     * ORDER BY and the keyset comparison share this same expression, so its collation governs both
     * and the cursor value is carried verbatim from Java.
     */
    default String displayNameSortExpression() {
      return Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
          ? "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ingestion_pipeline_entity.json, '$.displayName')), ''), ingestion_pipeline_entity.name)"
          : "COALESCE(NULLIF(ingestion_pipeline_entity.json ->> 'displayName', ''), ingestion_pipeline_entity.name)";
    }

    @SqlQuery(
        "SELECT ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond> "
            + "ORDER BY <displayExpr> <order>, ingestion_pipeline_entity.id <order> LIMIT :limit")
    List<String> listByDisplayName(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Define("displayExpr") String displayExpr,
        @Define("order") String order,
        @Bind("limit") int limit);

    @SqlQuery(
        "SELECT ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond> "
            + "AND (<displayExpr> <op> :afterDisplayName "
            + "OR (<displayExpr> = :afterDisplayName "
            + "AND ingestion_pipeline_entity.id <op> :afterId)) "
            + "ORDER BY <displayExpr> <order>, ingestion_pipeline_entity.id <order> LIMIT :limit")
    List<String> listAfterByDisplayName(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Define("displayExpr") String displayExpr,
        @Define("order") String order,
        @Define("op") String op,
        @Bind("limit") int limit,
        @Bind("afterDisplayName") String afterDisplayName,
        @Bind("afterId") String afterId);

    // Walks backwards in the reverse direction, then re-sorts the page into the requested order.
    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT <displayExpr> AS sort_key, ingestion_pipeline_entity.id, "
            + "ingestion_pipeline_entity.json FROM ingestion_pipeline_entity <cond> "
            + "AND (<displayExpr> <op> :beforeDisplayName "
            + "OR (<displayExpr> = :beforeDisplayName "
            + "AND ingestion_pipeline_entity.id <op> :beforeId)) "
            + "ORDER BY <displayExpr> <reverseOrder>, "
            + "ingestion_pipeline_entity.id <reverseOrder> LIMIT :limit"
            + ") last_rows_subquery ORDER BY sort_key <order>, id <order>")
    List<String> listBeforeByDisplayName(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Define("displayExpr") String displayExpr,
        @Define("order") String order,
        @Define("reverseOrder") String reverseOrder,
        @Define("op") String op,
        @Bind("limit") int limit,
        @Bind("beforeDisplayName") String beforeDisplayName,
        @Bind("beforeId") String beforeId);
  }

  interface PipelineServiceDAO extends EntityDAO<PipelineService> {
    @Override
    default String getTableName() {
      return "pipeline_service_entity";
    }

    @Override
    default Class<PipelineService> getEntityClass() {
      return PipelineService.class;
    }
  }

  interface MlModelServiceDAO extends EntityDAO<MlModelService> {
    @Override
    default String getTableName() {
      return "mlmodel_service_entity";
    }

    @Override
    default Class<MlModelService> getEntityClass() {
      return MlModelService.class;
    }
  }

  interface PolicyDAO extends EntityDAO<Policy> {
    @Override
    default String getTableName() {
      return "policy_entity";
    }

    @Override
    default Class<Policy> getEntityClass() {
      return Policy.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface ReportDAO extends EntityDAO<Report> {
    @Override
    default String getTableName() {
      return "report_entity";
    }

    @Override
    default Class<Report> getEntityClass() {
      return Report.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface TableDAO extends EntityDAO<Table> {
    @Override
    default String getTableName() {
      return "table_entity";
    }

    @Override
    default Class<Table> getEntityClass() {
      return Table.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')",
        connectionType = POSTGRES)
    List<String> getBrokenTables();

    @SqlUpdate(
        value =
            "delete from table_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseSchema' and toEntity = 'table')")
    int removeBrokenTables();

    @Override
    default int listCount(ListFilter filter) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listCount(
            getTableName(),
            getNameHashColumn(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition);
      }

      String condition = filter.getCondition(getTableName());
      return listCount(
          getTableName(), getNameHashColumn(), filter.getQueryParams(), condition, condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listBefore(
            getTableName(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition,
            limit,
            beforeName,
            beforeId);
      }
      String condition = filter.getCondition(getTableName());
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          condition,
          condition,
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String includeEmptyTestSuite = filter.getQueryParam("includeEmptyTestSuite");
      if (includeEmptyTestSuite != null && !Boolean.parseBoolean(includeEmptyTestSuite)) {
        String condition =
            String.format(
                "INNER JOIN entity_relationship er ON %s.id=er.fromId AND er.relation=%s AND er.toEntity='%s'",
                getTableName(), CONTAINS.ordinal(), Entity.TEST_SUITE);
        String mySqlCondition = condition;
        String postgresCondition = condition;

        mySqlCondition =
            String.format("%s %s", mySqlCondition, filter.getCondition(getTableName()));
        postgresCondition =
            String.format("%s %s", postgresCondition, filter.getCondition(getTableName()));
        return listAfter(
            getTableName(),
            filter.getQueryParams(),
            mySqlCondition,
            postgresCondition,
            limit,
            afterName,
            afterId);
      }
      String condition = filter.getCondition(getTableName());
      return listAfter(
          getTableName(), filter.getQueryParams(), condition, condition, limit, afterName, afterId);
    }
  }

  interface StoredProcedureDAO extends EntityDAO<StoredProcedure> {
    @Override
    default String getTableName() {
      return "stored_procedure_entity";
    }

    @Override
    default Class<StoredProcedure> getEntityClass() {
      return StoredProcedure.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface QueryDAO extends EntityDAO<Query> {
    @Override
    default String getTableName() {
      return "query_entity";
    }

    @Override
    default Class<Query> getEntityClass() {
      return Query.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @Override
    default int listCount(ListFilter filter) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :id and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntityType",
                condition);
        bindMap.put("id", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntityType", QUERY);
        return listQueryCount(condition, bindMap);
      }
      return EntityDAO.super.listCount(filter);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :entityId and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntity and (query_entity.name < :beforeName OR (query_entity.name = :beforeName AND query_entity.id < :beforeId))  order by query_entity.name DESC, query_entity.id DESC LIMIT :limit",
                condition);
        bindMap.put("entityId", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntity", QUERY);
        bindMap.put("beforeName", beforeName);
        bindMap.put("beforeId", beforeId);
        bindMap.put("limit", limit);
        return listBeforeQueriesByEntityId(condition, bindMap);
      }
      return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String entityId = filter.getQueryParam("entityId");
      String condition =
          "INNER JOIN entity_relationship ON query_entity.id = entity_relationship.toId";
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId)) {
        condition =
            String.format(
                "%s WHERE entity_relationship.fromId = :entityId and entity_relationship.relation = :relation and entity_relationship.toEntity = :toEntity and (query_entity.name > :afterName OR (query_entity.name = :afterName AND query_entity.name > :afterId))  order by query_entity.name ASC,query_entity.id ASC LIMIT :limit",
                condition);

        bindMap.put("entityId", entityId);
        bindMap.put("relation", MENTIONED_IN.ordinal());
        bindMap.put("toEntity", QUERY);
        bindMap.put("afterName", afterName);
        bindMap.put("afterId", afterId);
        bindMap.put("limit", limit);
        return listAfterQueriesByEntityId(condition, bindMap);
      }
      return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
    }

    @SqlQuery("SELECT query_entity.json FROM query_entity <cond>")
    List<String> listAfterQueriesByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json FROM (SELECT query_entity.name, query_entity.id, query_entity.json FROM query_entity <cond>) last_rows_subquery ORDER BY name,id")
    List<String> listBeforeQueriesByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery("SELECT count(*) FROM query_entity <cond> ")
    int listQueryCount(@Define("cond") String cond, @BindMap Map<String, Object> bindings);
  }

  interface PipelineDAO extends EntityDAO<Pipeline> {
    @Override
    default String getTableName() {
      return "pipeline_entity";
    }

    @Override
    default Class<Pipeline> getEntityClass() {
      return Pipeline.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition =
            buildStatusJoinCondition(getTableName(), condition, status, beforeName, beforeId, true);
        return listBeforeWithStatus(
            statusCondition, getBindMap(cleanFilter, status, limit, beforeName, beforeId));
      }
      return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition =
            buildStatusJoinCondition(getTableName(), condition, status, afterName, afterId, false);
        return listAfterWithStatus(
            statusCondition, getBindMap(cleanFilter, status, limit, afterName, afterId));
      }
      return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      String status = filter.getQueryParam("status");
      if (status != null && !status.isEmpty()) {
        // Remove status from filter to avoid SQL error
        Map<String, String> params = new HashMap<>(filter.getQueryParams());
        params.remove("status");
        ListFilter cleanFilter = new ListFilter(filter.getInclude());
        params.forEach(cleanFilter::addQueryParam);

        // Build condition with status JOIN
        String condition = cleanFilter.getCondition();
        String statusCondition = buildStatusCountCondition(getTableName(), condition, status);
        return listCountWithStatus(statusCondition, getBindMap(cleanFilter, status, 0, null, null));
      }
      return EntityDAO.super.listCount(filter);
    }

    default String buildStatusJoinCondition(
        String tableName,
        String baseCondition,
        String status,
        String name,
        String id,
        boolean isBefore) {
      String orderDirection = isBefore ? "DESC" : "ASC";
      String nameComparison = isBefore ? "<" : ">";
      String idComparison = isBefore ? "<" : ">";

      return String.format(
          "INNER JOIN ("
              + "  SELECT entityFQNHash, JSON_UNQUOTE(JSON_EXTRACT(json, '$.executionStatus')) as execStatus "
              + "  FROM entity_extension_time_series "
              + "  WHERE extension = 'pipeline.pipelineStatus' "
              + "    AND timestamp = (SELECT MAX(timestamp) FROM entity_extension_time_series eets2 "
              + "                      WHERE eets2.entityFQNHash = entity_extension_time_series.entityFQNHash "
              + "                      AND eets2.extension = 'pipeline.pipelineStatus') "
              + ") latest_status ON %s.fqnHash = latest_status.entityFQNHash "
              + "%s AND latest_status.execStatus = :status "
              + "AND (%s.name %s :beforeAfterName OR (%s.name = :beforeAfterName AND %s.id %s :beforeAfterId)) "
              + "ORDER BY %s.name %s, %s.id %s LIMIT :limit",
          tableName,
          baseCondition,
          tableName,
          nameComparison,
          tableName,
          tableName,
          idComparison,
          tableName,
          orderDirection,
          tableName,
          orderDirection);
    }

    default String buildStatusCountCondition(
        String tableName, String baseCondition, String status) {
      return String.format(
          "INNER JOIN ("
              + "  SELECT entityFQNHash, JSON_UNQUOTE(JSON_EXTRACT(json, '$.executionStatus')) as execStatus "
              + "  FROM entity_extension_time_series "
              + "  WHERE extension = 'pipeline.pipelineStatus' "
              + "    AND timestamp = (SELECT MAX(timestamp) FROM entity_extension_time_series eets2 "
              + "                      WHERE eets2.entityFQNHash = entity_extension_time_series.entityFQNHash "
              + "                      AND eets2.extension = 'pipeline.pipelineStatus') "
              + ") latest_status ON %s.fqnHash = latest_status.entityFQNHash "
              + "%s AND latest_status.execStatus = :status",
          tableName, baseCondition);
    }

    default Map<String, Object> getBindMap(
        ListFilter filter, String status, int limit, String name, String id) {
      Map<String, Object> bindMap = new HashMap<>();
      if (status != null) {
        bindMap.put("status", status);
      }
      if (limit > 0) {
        bindMap.put("limit", limit);
      }
      if (name != null) {
        bindMap.put("beforeAfterName", name);
      }
      if (id != null) {
        bindMap.put("beforeAfterId", id);
      }
      // Add filter params
      bindMap.putAll(filter.getQueryParams());
      return bindMap;
    }

    @SqlQuery("SELECT json FROM pipeline_entity <cond>")
    List<String> listAfterWithStatus(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json FROM (SELECT name, id, json FROM pipeline_entity <cond>) last_rows_subquery ORDER BY name, id")
    List<String> listBeforeWithStatus(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery("SELECT count(*) FROM pipeline_entity <cond>")
    int listCountWithStatus(@Define("cond") String cond, @BindMap Map<String, Object> bindings);
  }
}
