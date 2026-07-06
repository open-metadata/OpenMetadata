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
import static org.openmetadata.schema.type.Relationship.HAS;
import static org.openmetadata.schema.type.Relationship.OWNS;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindFQN;

public interface KnowledgeAssetDAOs {
  @CreateSqlObject
  FolderDAO folderDAO();

  @CreateSqlObject
  ContextFileDAO contextFileDAO();

  @CreateSqlObject
  ContextFileContentDAO contextFileContentDAO();

  @CreateSqlObject
  KnowledgePageDAO knowledgePageDAO();

  interface FolderDAO extends EntityDAO<org.openmetadata.schema.entity.data.Folder> {
    @Override
    default String getTableName() {
      return "drive_folder";
    }

    @Override
    default Class<org.openmetadata.schema.entity.data.Folder> getEntityClass() {
      return org.openmetadata.schema.entity.data.Folder.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }
  }

  interface ContextFileDAO extends EntityDAO<org.openmetadata.schema.entity.data.ContextFile> {
    @Override
    default String getTableName() {
      return "context_file";
    }

    @Override
    default Class<org.openmetadata.schema.entity.data.ContextFile> getEntityClass() {
      return org.openmetadata.schema.entity.data.ContextFile.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM context_file cf "
                + "LEFT JOIN entity_relationship er "
                + "ON er.toId = cf.id AND er.fromEntity = 'folder' "
                + "AND er.toEntity = 'contextFile' AND er.relation = :containsRelation "
                + "AND er.deleted = false "
                + "WHERE LOWER(cf.name) = LOWER(:fileName) "
                + "AND ((:folderId IS NULL AND er.fromId IS NULL) OR er.fromId = :folderId) "
                + "AND (:excludeId IS NULL OR cf.id <> :excludeId) "
                + "AND (cf.deleted = false OR cf.deleted IS NULL)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM context_file cf "
                + "LEFT JOIN entity_relationship er "
                + "ON er.toId = cf.id AND er.fromEntity = 'folder' "
                + "AND er.toEntity = 'contextFile' AND er.relation = :containsRelation "
                + "AND er.deleted = false "
                + "WHERE LOWER(cf.name) = LOWER(:fileName) "
                + "AND ((:folderId IS NULL AND er.fromId IS NULL) OR er.fromId = :folderId) "
                + "AND (:excludeId IS NULL OR cf.id <> :excludeId) "
                + "AND (cf.deleted = false OR cf.deleted IS NULL)",
        connectionType = POSTGRES)
    int countByFileNameInFolder(
        @Bind("fileName") String fileName,
        @Bind("folderId") String folderId,
        @Bind("excludeId") String excludeId,
        @Bind("containsRelation") int containsRelation);

    @SqlQuery("SELECT json FROM context_file <cond> ORDER BY updatedAt ASC, id ASC LIMIT :limit")
    List<String> listByUpdatedAtAsc(
        @BindMap Map<String, ?> params, @Define("cond") String cond, @Bind("limit") int limit);

    @SqlQuery("SELECT json FROM context_file <cond> ORDER BY updatedAt DESC, id DESC LIMIT :limit")
    List<String> listByUpdatedAtDesc(
        @BindMap Map<String, ?> params, @Define("cond") String cond, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT json FROM context_file <cond> "
            + "AND (updatedAt > :afterUpdatedAt OR (updatedAt = :afterUpdatedAt AND id > :afterId)) "
            + "ORDER BY updatedAt ASC, id ASC LIMIT :limit")
    List<String> listAfterByUpdatedAtAsc(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("limit") int limit,
        @Bind("afterUpdatedAt") long afterUpdatedAt,
        @Bind("afterId") String afterId);

    @SqlQuery(
        "SELECT json FROM context_file <cond> "
            + "AND (updatedAt < :afterUpdatedAt OR (updatedAt = :afterUpdatedAt AND id < :afterId)) "
            + "ORDER BY updatedAt DESC, id DESC LIMIT :limit")
    List<String> listAfterByUpdatedAtDesc(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("limit") int limit,
        @Bind("afterUpdatedAt") long afterUpdatedAt,
        @Bind("afterId") String afterId);

    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT updatedAt, id, json FROM context_file <cond> "
            + "AND (updatedAt < :beforeUpdatedAt OR (updatedAt = :beforeUpdatedAt AND id < :beforeId)) "
            + "ORDER BY updatedAt DESC, id DESC LIMIT :limit"
            + ") last_rows_subquery ORDER BY updatedAt ASC, id ASC")
    List<String> listBeforeByUpdatedAtAsc(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("limit") int limit,
        @Bind("beforeUpdatedAt") long beforeUpdatedAt,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT updatedAt, id, json FROM context_file <cond> "
            + "AND (updatedAt > :beforeUpdatedAt OR (updatedAt = :beforeUpdatedAt AND id > :beforeId)) "
            + "ORDER BY updatedAt ASC, id ASC LIMIT :limit"
            + ") last_rows_subquery ORDER BY updatedAt DESC, id DESC")
    List<String> listBeforeByUpdatedAtDesc(
        @BindMap Map<String, ?> params,
        @Define("cond") String cond,
        @Bind("limit") int limit,
        @Bind("beforeUpdatedAt") long beforeUpdatedAt,
        @Bind("beforeId") String beforeId);
  }

  interface ContextFileContentDAO
      extends EntityDAO<org.openmetadata.schema.entity.data.ContextFileContent> {
    @Override
    default String getTableName() {
      return "context_file_content";
    }

    @Override
    default Class<org.openmetadata.schema.entity.data.ContextFileContent> getEntityClass() {
      return org.openmetadata.schema.entity.data.ContextFileContent.class;
    }

    @Override
    default String getNameHashColumn() {
      return "nameHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM context_file_content "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.contextFile.id')) = :contextFileId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM context_file_content "
                + "WHERE json->'contextFile'->>'id' = :contextFileId",
        connectionType = POSTGRES)
    List<String> listByContextFileId(@Bind("contextFileId") String contextFileId);
  }

  interface KnowledgePageDAO extends EntityDAO<org.openmetadata.schema.entity.data.Page> {
    String KNOWLEDGE_PAGE_ENTITY = "page";

    @Override
    default String getTableName() {
      return "knowledge_center";
    }

    @Override
    default Class<org.openmetadata.schema.entity.data.Page> getEntityClass() {
      return org.openmetadata.schema.entity.data.Page.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    /**
     * When the caller supplies {@code entityId} + {@code entityType} (e.g. from a data-asset
     * page that wants the list of knowledge pages referencing it), join against
     * {@code entity_relationship} so that only pages whose {@code relatedEntities} contains
     * the target entity are returned. Without this override, the base {@code EntityDAO.listAfter}
     * ignores those params and returns every knowledge page — breaking the Knowledge
     * Articles right-panel widget (and the corresponding playwright assertions).
     */
    @Override
    default int listCount(ListFilter filter) {
      String entityId = filter.getQueryParam("entityId");
      String entityType = filter.getQueryParam("entityType");
      String knowledgePageType = filter.getQueryParam("pageType");
      String tagFQN = filter.getQueryParam("tagFQN");
      String tagListCondition =
          "INNER JOIN tag_usage ON knowledge_center.fqnHash = tag_usage.targetFQNHash";
      String tagFilterCondition = "WHERE tag_usage.tagFQN = :tagFQN and ";
      if (nullOrEmpty(tagFQN)) {
        tagListCondition = "";
        tagFilterCondition = "WHERE";
      }
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId) && !nullOrEmpty(entityType)) {
        String knowledgePageTypeQuery = getKnowledgePageTypeQuery("AND", knowledgePageType);
        String condition =
            String.format(
                "INNER JOIN entity_relationship ON knowledge_center.id = entity_relationship.toId %s %s "
                    + "entity_relationship.fromId IN (%s) %s"
                    + "and entity_relationship.toEntity = :toEntityType %s",
                tagListCondition,
                tagFilterCondition,
                entityId,
                getRelationCondition(entityType),
                knowledgePageTypeQuery);
        bindMap.put("toEntityType", KNOWLEDGE_PAGE_ENTITY);
        bindMap.put("tagFQN", tagFQN);
        if (!nullOrEmpty(knowledgePageTypeQuery)) {
          bindMap.put("pageType", knowledgePageType);
        }
        return listKnowledgePageCountByEntity(condition, bindMap);
      } else if ((!nullOrEmpty(entityId) && nullOrEmpty(entityType))
          || (nullOrEmpty(entityId) && !nullOrEmpty(entityType))) {
        throw new IllegalArgumentException(
            "Query Param Entity Id and Entity Type both needs to be provided.");
      }

      String knowledgePageQueryClause =
          String.format(
              "%s %s %s",
              tagListCondition,
              tagFilterCondition,
              getKnowledgePageTypeQuery("", knowledgePageType));
      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          getKnowledgePageWhereClause(knowledgePageQueryClause));
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String entityId = filter.getQueryParam("entityId");
      String entityType = filter.getQueryParam("entityType");
      String knowledgePageType = filter.getQueryParam("pageType");
      String tagFQN = filter.getQueryParam("tagFQN");
      String tagListCondition =
          "INNER JOIN tag_usage ON knowledge_center.fqnHash = tag_usage.targetFQNHash";
      String tagFilterCondition = "WHERE tag_usage.tagFQN = :tagFQN and ";
      if (nullOrEmpty(tagFQN)) {
        tagListCondition = "";
        tagFilterCondition = "WHERE";
      }
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId) && !nullOrEmpty(entityType)) {
        String knowledgePageTypeQuery = getKnowledgePageTypeQuery("AND", knowledgePageType);
        String condition =
            String.format(
                "INNER JOIN entity_relationship ON knowledge_center.id = entity_relationship.toId %s %s entity_relationship.fromId IN (%s) "
                    + "%s and entity_relationship.toEntity = :toEntity %s "
                    + "and (knowledge_center.name < :beforeName OR (knowledge_center.name = :beforeName AND knowledge_center.id < :beforeId)) order by knowledge_center.name DESC,knowledge_center.id DESC LIMIT :limit",
                tagListCondition,
                tagFilterCondition,
                entityId,
                getRelationCondition(entityType),
                knowledgePageTypeQuery);
        bindMap.put("toEntity", KNOWLEDGE_PAGE_ENTITY);
        bindMap.put("beforeName", beforeName);
        bindMap.put("beforeId", beforeId);
        bindMap.put("limit", limit);
        bindMap.put("tagFQN", tagFQN);
        if (!nullOrEmpty(knowledgePageTypeQuery)) {
          bindMap.put("pageType", knowledgePageType);
        }
        return listBeforeKnowledgePageByEntityId(condition, bindMap);
      } else if ((!nullOrEmpty(entityId) && nullOrEmpty(entityType))
          || (nullOrEmpty(entityId) && !nullOrEmpty(entityType))) {
        throw new IllegalArgumentException(
            "Query Param Entity Id and Entity Type both needs to be provided.");
      }
      String knowledgePageQueryClause =
          String.format(
              "%s %s %s",
              tagListCondition,
              tagFilterCondition,
              getKnowledgePageTypeQuery("", knowledgePageType));
      beforeName = FullyQualifiedName.unquoteName(beforeName);
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          getKnowledgePageWhereClause(knowledgePageQueryClause),
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String entityId = filter.getQueryParam("entityId");
      String entityType = filter.getQueryParam("entityType");
      String knowledgePageType = filter.getQueryParam("pageType");
      String tagFQN = filter.getQueryParam("tagFQN");
      String tagListCondition =
          "INNER JOIN tag_usage ON knowledge_center.fqnHash = tag_usage.targetFQNHash";
      String tagFilterCondition = "WHERE tag_usage.tagFQN = :tagFQN and ";
      if (nullOrEmpty(tagFQN)) {
        tagListCondition = "";
        tagFilterCondition = "WHERE";
      }
      Map<String, Object> bindMap = new HashMap<>();
      if (!nullOrEmpty(entityId) && !nullOrEmpty(entityType)) {
        String knowledgePageTypeQuery = getKnowledgePageTypeQuery("AND", knowledgePageType);
        String condition =
            String.format(
                "INNER JOIN entity_relationship ON knowledge_center.id = entity_relationship.toId %s %s entity_relationship.fromId IN (%s) "
                    + "%s and entity_relationship.toEntity = :toEntity %s "
                    + "and (knowledge_center.name > :afterName OR (knowledge_center.name = :afterName AND knowledge_center.id > :afterId)) order by knowledge_center.name ASC,knowledge_center.id ASC LIMIT :limit",
                tagListCondition,
                tagFilterCondition,
                entityId,
                getRelationCondition(entityType),
                knowledgePageTypeQuery);
        bindMap.put("toEntity", KNOWLEDGE_PAGE_ENTITY);
        bindMap.put("afterName", afterName);
        bindMap.put("afterId", afterId);
        bindMap.put("limit", limit);
        bindMap.put("tagFQN", tagFQN);
        if (!nullOrEmpty(knowledgePageTypeQuery)) {
          bindMap.put("pageType", knowledgePageType);
        }
        return listAfterKnowledgePageByEntityId(condition, bindMap);
      } else if ((!nullOrEmpty(entityId) && nullOrEmpty(entityType))
          || (nullOrEmpty(entityId) && !nullOrEmpty(entityType))) {
        throw new IllegalArgumentException(
            "Query Param Entity Id and Entity Type both needs to be provided.");
      }
      String knowledgePageQueryClause =
          String.format(
              "%s %s %s",
              tagListCondition,
              tagFilterCondition,
              getKnowledgePageTypeQuery("", knowledgePageType));
      afterName = FullyQualifiedName.unquoteName(afterName);
      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          getKnowledgePageWhereClause(knowledgePageQueryClause),
          limit,
          afterName,
          afterId);
    }

    private String getRelationCondition(String entityType) {
      // Users/teams "own" pages (membership-based); every other entity type reaches the page
      // through a HAS relationship (the page's relatedEntities list).
      String owns = String.valueOf(OWNS.ordinal());
      String has = String.valueOf(HAS.ordinal());
      if (entityType.equals(USER) || entityType.equals(TEAM)) {
        return String.format(" and entity_relationship.relation = %s ", owns);
      } else {
        return String.format(" and entity_relationship.relation = %s ", has);
      }
    }

    private String getKnowledgePageWhereClause(String knowledgePageQueryClause) {
      return nullOrEmpty(knowledgePageQueryClause) ? "WHERE TRUE" : knowledgePageQueryClause;
    }

    private String getKnowledgePageTypeQuery(String clause, String type) {
      if (!nullOrEmpty(type)) {
        if (Boolean.TRUE.equals(
            org.openmetadata.service.resources.databases.DatasourceConfig.getInstance()
                .isMySQL())) {
          return String.format(
              " %s JSON_EXTRACT(knowledge_center.json, '$.pageType') = :pageType", clause);
        } else {
          return String.format(" %s knowledge_center.json->>'pageType' = :pageType", clause);
        }
      }
      if ("AND".equals(clause)) {
        return "";
      }
      return "TRUE";
    }

    @SqlQuery("SELECT knowledge_center.json FROM knowledge_center <cond>")
    List<String> listAfterKnowledgePageByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json FROM (SELECT knowledge_center.name,knowledge_center.id, knowledge_center.json FROM knowledge_center <cond>) last_rows_subquery ORDER BY name,id")
    List<String> listBeforeKnowledgePageByEntityId(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery("SELECT count(*) FROM knowledge_center <cond> ")
    int listKnowledgePageCountByEntity(
        @Define("cond") String cond, @BindMap Map<String, Object> bindings);

    @SqlQuery(
        "SELECT json "
            + "FROM knowledge_center "
            + "WHERE id NOT IN ("
            + "    SELECT toId FROM entity_relationship WHERE (relation = 0 AND toEntity = 'page') OR (relation = 9 AND toEntity = 'page')"
            + ")")
    List<String> listTopLevelPages();

    @SqlQuery(
        "SELECT kc.json "
            + "FROM knowledge_center kc "
            + "JOIN entity_relationship er ON kc.id = er.toId "
            + "WHERE er.fromId = :parentId "
            + "AND (er.relation = 9 or er.relation = 0) "
            + "AND er.toEntity = 'page'")
    List<String> listChildren(@Bind("parentId") String parentId);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE knowledge_center SET json = :json, fqnHash = :fqnHash  WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE knowledge_center SET json = :json::jsonb, fqnHash = :fqnHash WHERE id = :id",
        connectionType = POSTGRES)
    void updateFullyQualifiedName(
        @Bind("id") String pageId, @Bind("json") String json, @BindFQN("fqnHash") String fqnHash);
  }
}
