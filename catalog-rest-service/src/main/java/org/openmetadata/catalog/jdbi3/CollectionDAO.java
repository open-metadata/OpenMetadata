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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.entity.Bots;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.AirflowPipelineRepository.AirflowPipelineEntityInterface;
import org.openmetadata.catalog.jdbi3.BotsRepository.BotsEntityInterface;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartEntityInterface;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TagDAO.TagLabelMapper;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UsageDAO.UsageDetailsMapper;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseEntityInterface;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.GlossaryRepository.GlossaryEntityInterface;
import org.openmetadata.catalog.jdbi3.GlossaryTermRepository.GlossaryTermEntityInterface;
import org.openmetadata.catalog.jdbi3.LocationRepository.LocationEntityInterface;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsEntityInterface;
import org.openmetadata.catalog.jdbi3.MlModelRepository.MlModelEntityInterface;
import org.openmetadata.catalog.jdbi3.PipelineRepository.PipelineEntityInterface;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.PolicyRepository.PolicyEntityInterface;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportEntityInterface;
import org.openmetadata.catalog.jdbi3.RoleRepository.RoleEntityInterface;
import org.openmetadata.catalog.jdbi3.StorageServiceRepository.StorageServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.TableRepository.TableEntityInterface;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamEntityInterface;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicEntityInterface;
import org.openmetadata.catalog.jdbi3.UserRepository.UserEntityInterface;
import org.openmetadata.catalog.jdbi3.WebhookRepository.WebhookEntityInterface;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.util.EntityUtil;

public interface CollectionDAO {
  @CreateSqlObject
  DatabaseDAO databaseDAO();

  @CreateSqlObject
  EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  FieldRelationshipDAO fieldRelationshipDAO();

  @CreateSqlObject
  EntityExtensionDAO entityExtensionDAO();

  @CreateSqlObject
  RoleDAO roleDAO();

  @CreateSqlObject
  UserDAO userDAO();

  @CreateSqlObject
  TeamDAO teamDAO();

  @CreateSqlObject
  TagDAO tagDAO();

  @CreateSqlObject
  TableDAO tableDAO();

  @CreateSqlObject
  UsageDAO usageDAO();

  @CreateSqlObject
  MetricsDAO metricsDAO();

  @CreateSqlObject
  ChartDAO chartDAO();

  @CreateSqlObject
  PipelineDAO pipelineDAO();

  @CreateSqlObject
  DashboardDAO dashboardDAO();

  @CreateSqlObject
  ReportDAO reportDAO();

  @CreateSqlObject
  TopicDAO topicDAO();

  @CreateSqlObject
  MlModelDAO mlModelDAO();

  @CreateSqlObject
  GlossaryDAO glossaryDAO();

  @CreateSqlObject
  GlossaryTermDAO glossaryTermDAO();

  @CreateSqlObject
  BotsDAO botsDAO();

  @CreateSqlObject
  PolicyDAO policyDAO();

  @CreateSqlObject
  AirflowPipelineDAO airflowPipelineDAO();

  @CreateSqlObject
  DatabaseServiceDAO dbServiceDAO();

  @CreateSqlObject
  PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  MessagingServiceDAO messagingServiceDAO();

  @CreateSqlObject
  StorageServiceDAO storageServiceDAO();

  @CreateSqlObject
  FeedDAO feedDAO();

  @CreateSqlObject
  LocationDAO locationDAO();

  @CreateSqlObject
  ChangeEventDAO changeEventDAO();

  @CreateSqlObject
  WebhookDAO webhookDAO();

  interface DashboardDAO extends EntityDAO<Dashboard> {
    @Override
    default String getTableName() {
      return "dashboard_entity";
    }

    @Override
    default Class<Dashboard> getEntityClass() {
      return Dashboard.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Dashboard entity) {
      return new DashboardEntityInterface(entity).getEntityReference();
    }
  }

  interface DashboardServiceDAO extends EntityDAO<DashboardService> {
    @Override
    default String getTableName() {
      return "dashboard_service_entity";
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default Class<DashboardService> getEntityClass() {
      return DashboardService.class;
    }

    @Override
    default EntityReference getEntityReference(DashboardService entity) {
      return new DashboardServiceEntityInterface(entity).getEntityReference();
    }
  }

  interface DatabaseDAO extends EntityDAO<Database> {
    @Override
    default String getTableName() {
      return "database_entity";
    }

    @Override
    default Class<Database> getEntityClass() {
      return Database.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Database entity) {
      return new DatabaseEntityInterface(entity).getEntityReference();
    }
  }

  interface DatabaseServiceDAO extends EntityDAO<DatabaseService> {
    @Override
    default String getTableName() {
      return "dbservice_entity";
    }

    @Override
    default Class<DatabaseService> getEntityClass() {
      return DatabaseService.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(DatabaseService entity) {
      return new DatabaseServiceEntityInterface(entity).getEntityReference();
    }
  }

  interface StorageServiceDAO extends EntityDAO<StorageService> {
    @Override
    default String getTableName() {
      return "storage_service_entity";
    }

    @Override
    default Class<StorageService> getEntityClass() {
      return StorageService.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(StorageService entity) {
      return new StorageServiceEntityInterface(entity).getEntityReference();
    }
  }

  interface EntityExtensionDAO {
    @SqlUpdate(
        "REPLACE INTO entity_extension(id, extension, jsonSchema, json) "
            + "VALUES (:id, :extension, :jsonSchema, :json)")
    void insert(
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
    String getExtension(@Bind("id") String id, @Bind("extension") String extension);

    @RegisterRowMapper(EntityVersionMapper.class)
    @SqlQuery(
        "SELECT extension, json FROM entity_extension WHERE id = :id AND extension "
            + "LIKE CONCAT (:extensionPrefix, '.%')")
    List<EntityVersionPair> getEntityVersions(@Bind("id") String id, @Bind("extensionPrefix") String extensionPrefix);

    @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
    String getEntityVersion(@Bind("id") String id, @Bind("extension") String extension);
  }

  class EntityVersionPair {
    private final Double version;
    private final String entityJson;

    public Double getVersion() {
      return version;
    }

    public String getEntityJson() {
      return entityJson;
    }

    public EntityVersionPair(Double version, String json) {
      this.version = version;
      this.entityJson = json;
    }
  }

  class EntityVersionMapper implements RowMapper<EntityVersionPair> {
    @Override
    public EntityVersionPair map(ResultSet rs, StatementContext ctx) throws SQLException {
      Double version = EntityUtil.getVersion(rs.getString("extension"));
      return new EntityVersionPair(version, rs.getString("json"));
    }
  }

  interface EntityRelationshipDAO {
    default int insert(UUID fromId, UUID toId, String fromEntity, String toEntity, int relation) {
      return insert(fromId.toString(), toId.toString(), fromEntity, toEntity, relation);
    }

    @SqlUpdate(
        "INSERT IGNORE INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) "
            + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation)")
    int insert(
        @Bind("fromId") String fromId,
        @Bind("toId") String toId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    //
    // Find to operations
    //
    @SqlQuery(
        "SELECT toId, toEntity FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY toId")
    @RegisterRowMapper(ToEntityReferenceMapper.class)
    List<EntityReference> findTo(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT toId, toEntity FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY toId")
    @RegisterRowMapper(ToEntityReferenceMapper.class)
    List<EntityReference> findToReference(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT toId FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation AND toEntity = :toEntity "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY toId")
    List<String> findTo(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT count(*) FROM entity_relationship "
            + "WHERE fromId = :fromId AND fromEntity = :fromEntity AND relation = :relation "
            + "AND (toEntity = :toEntity || :toEntity IS NULL) "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY fromId")
    int findToCount(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity,
        @Bind("deleted") Boolean deleted);

    //
    // Find from operations
    //
    @SqlQuery(
        "SELECT fromId FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY fromId")
    List<String> findFrom(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT fromId, fromEntity FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY fromId")
    @RegisterRowMapper(FromEntityReferenceMapper.class)
    List<EntityReference> findFrom(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT fromId, fromEntity FROM entity_relationship "
            + "WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation AND fromEntity = :fromEntity "
            + "AND (deleted = :deleted OR :deleted IS NULL) "
            + "ORDER BY fromId")
    @RegisterRowMapper(FromEntityReferenceMapper.class)
    List<EntityReference> findFromEntity(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity,
        @Bind("deleted") Boolean deleted);

    //
    // Delete Operations
    //
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId "
            + "AND fromEntity = :fromEntity AND toId = :toId AND toEntity = :toEntity "
            + "AND relation = :relation")
    int delete(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation);

    // Delete all the entity relationship fromID --- relation --> entity of type toEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE fromId = :fromId AND fromEntity = :fromEntity "
            + "AND relation = :relation AND toEntity = :toEntity")
    int deleteFrom(
        @Bind("fromId") String fromId,
        @Bind("fromEntity") String fromEntity,
        @Bind("relation") int relation,
        @Bind("toEntity") String toEntity);

    // Delete all the entity relationship toId <-- relation --  entity of type fromEntity
    @SqlUpdate(
        "DELETE from entity_relationship WHERE toId = :toId AND toEntity = :toEntity AND relation = :relation "
            + "AND fromEntity = :fromEntity")
    int deleteTo(
        @Bind("toId") String toId,
        @Bind("toEntity") String toEntity,
        @Bind("relation") int relation,
        @Bind("fromEntity") String fromEntity);

    @SqlUpdate(
        "DELETE from entity_relationship WHERE (toId = :id AND toEntity = :entity) OR "
            + "(fromId = :id AND toEntity = :entity)")
    int deleteAll(@Bind("id") String id, @Bind("entity") String entity);

    @SqlUpdate(
        "UPDATE entity_relationship SET deleted = true WHERE (toId = :id AND toEntity = :entity) "
            + "OR (fromId = :id AND fromEntity = :entity)")
    void softDeleteAll(@Bind("id") String id, @Bind("entity") String entity);

    @SqlUpdate("UPDATE entity_relationship SET deleted = false WHERE toId = :id OR fromId = :id")
    int recoverSoftDeleteAll(@Bind("id") String id);
  }

  interface FeedDAO {
    @SqlUpdate("INSERT INTO thread_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM thread_entity ORDER BY updatedAt DESC")
    List<String> list();

    @SqlUpdate("UPDATE thread_entity SET json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery(
        "SELECT entityLink, COUNT(*) count FROM field_relationship fr INNER JOIN thread_entity te ON fr.fromFQN=te.id "
            + "WHERE fr.toFQN LIKE CONCAT(:fqnPrefix, '%') AND fr.toType like concat(:toType, '%') AND fr.fromType = :fromType "
            + "AND fr.relation = :relation AND te.resolved= :isResolved "
            + "GROUP BY entityLink")
    @RegisterRowMapper(CountFieldMapper.class)
    List<List<String>> listCountByEntityLink(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("isResolved") boolean isResolved);

    @SqlQuery(
        "SELECT entityLink, COUNT(*) count FROM thread_entity WHERE (id IN (<threadIds>)) "
            + "AND resolved= :isResolved GROUP BY entityLink")
    @RegisterRowMapper(CountFieldMapper.class)
    List<List<String>> listCountByThreads(
        @BindList("threadIds") List<String> threadIds, @Bind("isResolved") boolean isResolved);

    @SqlQuery(
        "SELECT id FROM thread_entity WHERE entityId in ("
            + "SELECT toId FROM entity_relationship WHERE "
            + "((fromEntity='user' AND fromId= :userId) OR "
            + "(fromEntity='team' AND fromId IN (<teamIds>))) AND relation= :relation)")
    List<String> listUserThreadsFromER(
        @Bind("userId") String userId, @BindList("teamIds") List<String> teamIds, @Bind("relation") int relation);

    @SqlQuery(
        "SELECT id FROM thread_entity WHERE id in ("
            + "SELECT toFQN FROM field_relationship WHERE "
            + "((fromType='user' AND fromFQN= :userName) OR "
            + "(fromType='team' AND fromFQN IN (<teamNames>)))  AND toType = :toType AND relation = :relation)")
    List<String> listUserThreadsFromFR(
        @Bind("userName") String userName,
        @BindList("teamNames") List<String> teamNames,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    class CountFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(rs.getString("entityLink"), rs.getString("count"));
      }
    }
  }

  interface FieldRelationshipDAO {
    @SqlUpdate(
        "INSERT IGNORE INTO field_relationship(fromFQN, toFQN, fromType, toType, relation) "
            + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation)")
    void insert(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlUpdate(
        "INSERT INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) "
            + "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, :json) "
            + "ON DUPLICATE KEY UPDATE json = :json")
    void upsert(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @SqlQuery(
        "SELECT json FROM field_relationship WHERE "
            + "fromFQN = :fromFQN AND toFQN = :toFQN AND fromType = :fromType "
            + "AND toType = :toType AND relation = :relation")
    String find(
        @Bind("fromFQN") String fromFQN,
        @Bind("toFQN") String toFQN,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "toFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<List<String>> listFromByPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "toFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType LIKE CONCAT(:toType, '%') AND relation = :relation")
    @RegisterRowMapper(FromFieldMapper.class)
    List<List<String>> listFromByAllPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlQuery(
        "SELECT fromFQN, toFQN, json FROM field_relationship WHERE "
            + "fromFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType "
            + "AND relation = :relation")
    @RegisterRowMapper(ToFieldMapper.class)
    List<List<String>> listToByPrefix(
        @Bind("fqnPrefix") String fqnPrefix,
        @Bind("fromType") String fromType,
        @Bind("toType") String toType,
        @Bind("relation") int relation);

    @SqlUpdate(
        "DELETE from field_relationship WHERE "
            + "(toFQN LIKE CONCAT(:fqnPrefix, '.%') OR fromFQN LIKE CONCAT(:fqnPrefix, '.%')) "
            + "AND relation = :relation")
    void deleteAllByPrefix(@Bind("fqnPrefix") String fqnPrefix, @Bind("relation") int relation);

    class ToFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(rs.getString("fromFQN"), rs.getString("toFQN"), rs.getString("json"));
      }
    }

    class FromFieldMapper implements RowMapper<List<String>> {
      @Override
      public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return Arrays.asList(rs.getString("toFQN"), rs.getString("fromFQN"), rs.getString("json"));
      }
    }
  }

  interface BotsDAO extends EntityDAO<Bots> {
    @Override
    default String getTableName() {
      return "bots_entity";
    }

    @Override
    default Class<Bots> getEntityClass() {
      return Bots.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Bots entity) {
      return new BotsEntityInterface(entity).getEntityReference();
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Chart entity) {
      return new ChartEntityInterface(entity).getEntityReference();
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

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(MessagingService entity) {
      return new MessagingServiceEntityInterface(entity).getEntityReference();
    }
  }

  interface MetricsDAO extends EntityDAO<Metrics> {
    @Override
    default String getTableName() {
      return "metrics_entity";
    }

    @Override
    default Class<Metrics> getEntityClass() {
      return Metrics.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Metrics entity) {
      return new MetricsEntityInterface(entity).getEntityReference();
    }
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(MlModel entity) {
      return new MlModelEntityInterface(entity).getEntityReference();
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

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(Glossary entity) {
      return new GlossaryEntityInterface(entity).getEntityReference();
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(GlossaryTerm entity) {
      return new GlossaryTermEntityInterface(entity).getEntityReference();
    }
  }

  interface AirflowPipelineDAO extends EntityDAO<AirflowPipeline> {
    @Override
    default String getTableName() {
      return "airflow_pipeline_entity";
    }

    @Override
    default Class<AirflowPipeline> getEntityClass() {
      return AirflowPipeline.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(AirflowPipeline entity) {
      return new AirflowPipelineEntityInterface(entity).getEntityReference();
    }
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

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(PipelineService entity) {
      return new PipelineServiceEntityInterface(entity).getEntityReference();
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Policy entity) {
      return new PolicyEntityInterface(entity).getEntityReference();
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Report entity) {
      return new ReportEntityInterface(entity).getEntityReference();
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Table entity) {
      return new TableEntityInterface(entity).getEntityReference();
    }
  }

  interface LocationDAO extends EntityDAO<Location> {
    @Override
    default String getTableName() {
      return "location_entity";
    }

    @Override
    default Class<Location> getEntityClass() {
      return Location.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Location entity) {
      return new LocationEntityInterface(entity).getEntityReference();
    }

    @SqlQuery(
        "SELECT count(*) FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= CONCAT(:service, '.') AND "
            + "<nameColumn> <= :fqn")
    int listPrefixesCount(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("service") String service);

    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT <nameColumn>, json FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= CONCAT(:service, '.') AND "
            + "<nameColumn> <= :fqn AND "
            + "<nameColumn> < :before "
            + "ORDER BY <nameColumn> DESC "
            + // Pagination ordering by chart fullyQualifiedName
            "LIMIT :limit"
            + ") last_rows_subquery ORDER BY <nameColumn>")
    List<String> listPrefixesBefore(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("service") String service,
        @Bind("limit") int limit,
        @Bind("before") String before);

    @SqlQuery(
        "SELECT json FROM <table> WHERE "
            + "LEFT(:fqn, LENGTH(<nameColumn>)) = <nameColumn> AND "
            + "<nameColumn> >= CONCAT(:service, '.') AND "
            + "<nameColumn> <= :fqn AND "
            + "<nameColumn> > :after "
            + "ORDER BY <nameColumn> "
            + "LIMIT :limit")
    List<String> listPrefixesAfter(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("fqn") String fqn,
        @Bind("service") String service,
        @Bind("limit") int limit,
        @Bind("after") String after);
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
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Pipeline entity) {
      return new PipelineEntityInterface(entity).getEntityReference();
    }
  }

  interface WebhookDAO extends EntityDAO<Webhook> {
    @Override
    default String getTableName() {
      return "webhook_entity";
    }

    @Override
    default Class<Webhook> getEntityClass() {
      return Webhook.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(Webhook entity) {
      return new WebhookEntityInterface(entity).getEntityReference();
    }
  }

  @RegisterRowMapper(TagLabelMapper.class)
  interface TagDAO {
    @SqlUpdate("INSERT INTO tag_category (json) VALUES (:json)")
    void insertCategory(@Bind("json") String json);

    @SqlUpdate("INSERT INTO tag(json) VALUES (:json)")
    void insertTag(@Bind("json") String json);

    @SqlUpdate("UPDATE tag_category SET  json = :json where name = :name")
    void updateCategory(@Bind("name") String name, @Bind("json") String json);

    @SqlUpdate("UPDATE tag SET  json = :json where fullyQualifiedName = :fqn")
    void updateTag(@Bind("fqn") String fqn, @Bind("json") String json);

    @SqlQuery("SELECT json FROM tag_category ORDER BY name")
    List<String> listCategories();

    @SqlQuery("SELECT json FROM tag WHERE fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') ORDER BY fullyQualifiedName")
    List<String> listChildrenTags(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery("SELECT json FROM tag_category WHERE name = :name")
    String findCategory(@Bind("name") String name);

    @SqlQuery("SELECT EXISTS (SELECT * FROM tag WHERE fullyQualifiedName = :fqn)")
    boolean tagExists(@Bind("fqn") String fqn);

    @SqlQuery("SELECT json FROM tag WHERE fullyQualifiedName = :fqn")
    String findTag(@Bind("fqn") String fqn);

    @SqlUpdate(
        "INSERT IGNORE INTO tag_usage (source, tagFQN, targetFQN, labelType, state) "
            + "VALUES (:source, :tagFQN, :targetFQN, :labelType, :state)")
    void applyTag(
        @Bind("source") int source,
        @Bind("tagFQN") String tagFQN,
        @Bind("targetFQN") String targetFQN,
        @Bind("labelType") int labelType,
        @Bind("state") int state);

    @SqlQuery(
        "SELECT tu.source, tu.tagFQN, tu.labelType, tu.state, t.json ->> '$.description' "
            + "AS description FROM tag_usage tu "
            + "LEFT JOIN tag t ON tu.tagFQN = t.fullyQualifiedName WHERE tu.targetFQN = :targetFQN ORDER BY tu.tagFQN")
    List<TagLabel> getTags(@Bind("targetFQN") String targetFQN);

    @SqlQuery("SELECT COUNT(*) FROM tag_usage " + "WHERE tagFQN LIKE CONCAT(:fqnPrefix, '%') AND source = :source")
    int getTagCount(@Bind("source") int source, @Bind("fqnPrefix") String fqnPrefix);

    @SqlUpdate("DELETE FROM tag_usage where targetFQN = :targetFQN")
    void deleteTags(@Bind("targetFQN") String targetFQN);

    @SqlUpdate("DELETE FROM tag_usage where targetFQN LIKE CONCAT(:fqnPrefix, '%')")
    void deleteTagsByPrefix(@Bind("fqnPrefix") String fqnPrefix);

    class TagLabelMapper implements RowMapper<TagLabel> {
      @Override
      public TagLabel map(ResultSet r, StatementContext ctx) throws SQLException {
        return new TagLabel()
            .withSource(TagLabel.Source.values()[r.getInt("source")])
            .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
            .withState(TagLabel.State.values()[r.getInt("state")])
            .withTagFQN(r.getString("tagFQN"))
            .withDescription(r.getString("description"));
      }
    }
  }

  interface RoleDAO extends EntityDAO<Role> {
    @Override
    default String getTableName() {
      return "role_entity";
    }

    @Override
    default Class<Role> getEntityClass() {
      return Role.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @SqlQuery("SELECT id FROM role_entity WHERE `default` = TRUE")
    List<String> getDefaultRolesIds();

    @SqlQuery("SELECT json FROM role_entity WHERE `default` = TRUE")
    List<String> getDefaultRoles();

    @Override
    default EntityReference getEntityReference(Role entity) {
      return new RoleEntityInterface(entity).getEntityReference();
    }
  }

  interface TeamDAO extends EntityDAO<Team> {
    @Override
    default String getTableName() {
      return "team_entity";
    }

    @Override
    default Class<Team> getEntityClass() {
      return Team.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(Team entity) {
      return new TeamEntityInterface(entity).getEntityReference();
    }
  }

  interface TopicDAO extends EntityDAO<Topic> {
    @Override
    default String getTableName() {
      return "topic_entity";
    }

    @Override
    default Class<Topic> getEntityClass() {
      return Topic.class;
    }

    @Override
    default String getNameColumn() {
      return "fullyQualifiedName";
    }

    @Override
    default EntityReference getEntityReference(Topic entity) {
      return new TopicEntityInterface(entity).getEntityReference();
    }
  }

  @RegisterRowMapper(UsageDetailsMapper.class)
  interface UsageDAO {
    @SqlUpdate(
        "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
            + "SELECT :date, :id, :entityType, :count1, "
            + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
            + "INTERVAL 6 DAY)), "
            + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
            + "INTERVAL 29 DAY))")
    void insert(
        @Bind("date") String date,
        @Bind("id") String id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @SqlUpdate(
        "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
            + "SELECT :date, :id, :entityType, :count1, "
            + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
            + "INTERVAL 6 DAY)), "
            + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
            + "INTERVAL 29 DAY)) "
            + "ON DUPLICATE KEY UPDATE count1 = count1 + :count1, count7 = count7 + :count1, count30 = count30 + :count1")
    void insertOrUpdateCount(
        @Bind("date") String date,
        @Bind("id") String id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @SqlQuery(
        "SELECT id, usageDate, entityType, count1, count7, count30, "
            + "percentile1, percentile7, percentile30 FROM entity_usage "
            + "WHERE id = :id AND usageDate >= :date - INTERVAL :days DAY AND usageDate <= :date ORDER BY usageDate DESC")
    List<UsageDetails> getUsageById(@Bind("id") String id, @Bind("date") String date, @Bind("days") int days);

    /** Get latest usage record */
    @SqlQuery(
        "SELECT id, usageDate, entityType, count1, count7, count30, "
            + "percentile1, percentile7, percentile30 FROM entity_usage "
            + "WHERE usageDate IN (SELECT MAX(usageDate) FROM entity_usage WHERE id = :id) AND id = :id")
    UsageDetails getLatestUsage(@Bind("id") String id);

    @SqlUpdate("DELETE FROM entity_usage WHERE id = :id")
    int delete(@Bind("id") String id);

    /**
     * Note not using in following percentile computation PERCENT_RANK function as unit tests use mysql5.7, and it does
     * not have window function
     */
    @SqlUpdate(
        "UPDATE entity_usage u JOIN ( "
            + "SELECT u1.id, "
            + "(SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 <  u1.count1 AND u2.entityType = :entityType "
            + "AND u2.usageDate = :date) as p1, "
            + "(SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 <  u1.count7 AND u3.entityType = :entityType "
            + "AND u3.usageDate = :date) as p7, "
            + "(SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 <  u1.count30 AND u4.entityType = :entityType "
            + "AND u4.usageDate = :date) as p30, "
            + "(SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = :date) as total "
            + "FROM entity_usage u1 WHERE u1.entityType = :entityType AND u1.usageDate = :date"
            + ") vals ON u.id = vals.id AND usageDate = :date "
            + "SET u.percentile1 = ROUND(100 * p1/total, 2), u.percentile7 = ROUND(p7 * 100/total, 2), u.percentile30 ="
            + " ROUND(p30*100/total, 2)")
    void computePercentile(@Bind("entityType") String entityType, @Bind("date") String date);

    class UsageDetailsMapper implements RowMapper<UsageDetails> {
      @Override
      public UsageDetails map(ResultSet r, StatementContext ctx) throws SQLException {
        UsageStats dailyStats =
            new UsageStats().withCount(r.getInt("count1")).withPercentileRank(r.getDouble("percentile1"));
        UsageStats weeklyStats =
            new UsageStats().withCount(r.getInt("count7")).withPercentileRank(r.getDouble("percentile7"));
        UsageStats monthlyStats =
            new UsageStats().withCount(r.getInt("count30")).withPercentileRank(r.getDouble("percentile30"));
        return new UsageDetails()
            .withDate(r.getString("usageDate"))
            .withDailyStats(dailyStats)
            .withWeeklyStats(weeklyStats)
            .withMonthlyStats(monthlyStats);
      }
    }
  }

  interface UserDAO extends EntityDAO<User> {
    @Override
    default String getTableName() {
      return "user_entity";
    }

    @Override
    default Class<User> getEntityClass() {
      return User.class;
    }

    @Override
    default String getNameColumn() {
      return "name";
    }

    @Override
    default EntityReference getEntityReference(User entity) {
      return new UserEntityInterface(entity).getEntityReference();
    }

    @SqlQuery("SELECT json FROM user_entity WHERE email = :email")
    String findByEmail(@Bind("email") String email);

    @Override
    default int listCount(String team, Include include) {
      return listCount(getTableName(), getNameColumn(), team, Relationship.HAS.ordinal(), toBoolean(include));
    }

    @Override
    default List<String> listBefore(String team, int limit, String before, Include include) {
      return listBefore(
          getTableName(), getNameColumn(), team, limit, before, Relationship.HAS.ordinal(), toBoolean(include));
    }

    @Override
    default List<String> listAfter(String team, int limit, String after, Include include) {
      return listAfter(
          getTableName(), getNameColumn(), team, limit, after, Relationship.HAS.ordinal(), toBoolean(include));
    }

    @SqlQuery(
        "SELECT count(id) FROM ("
            + "SELECT ue.id "
            + "FROM user_entity ue "
            + "LEFT JOIN entity_relationship er on ue.id = er.toId "
            + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
            + "WHERE (te.name = :team OR :team IS NULL) "
            + "AND (ue.deleted = :deleted OR :deleted IS NULL) "
            + "AND (er.deleted = :deleted OR :deleted IS NULL OR (:team IS NULL AND er.deleted IS NULL)) "
            + "GROUP BY ue.id) subquery")
    int listCount(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("team") String team,
        @Bind("relation") int relation,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT json FROM ("
            + "SELECT ue.<nameColumn>, ue.json "
            + "FROM user_entity ue "
            + "LEFT JOIN entity_relationship er on ue.id = er.toId "
            + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
            + "WHERE (te.name = :team OR :team IS NULL) "
            + "AND (ue.deleted = :deleted OR :deleted IS NULL) "
            + "AND (er.deleted = :deleted OR :deleted IS NULL OR (:team IS NULL AND er.deleted IS NULL)) "
            + "AND ue.<nameColumn> < :before "
            + "GROUP BY ue.<nameColumn>, ue.json "
            + "ORDER BY ue.<nameColumn> DESC "
            + "LIMIT :limit"
            + ") last_rows_subquery ORDER BY <nameColumn>")
    List<String> listBefore(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("team") String team,
        @Bind("limit") int limit,
        @Bind("before") String before,
        @Bind("relation") int relation,
        @Bind("deleted") Boolean deleted);

    @SqlQuery(
        "SELECT ue.json "
            + "FROM user_entity ue "
            + "LEFT JOIN entity_relationship er on ue.id = er.toId "
            + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
            + "WHERE (te.name = :team OR :team IS NULL) "
            + "AND (ue.deleted = :deleted OR :deleted IS NULL) "
            + "AND (er.deleted = :deleted OR :deleted IS NULL OR (:team IS NULL AND er.deleted IS NULL)) "
            + "AND ue.<nameColumn> > :after "
            + "GROUP BY ue.json "
            + "ORDER BY ue.<nameColumn> "
            + "LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @Define("nameColumn") String nameColumn,
        @Bind("team") String team,
        @Bind("limit") int limit,
        @Bind("after") String after,
        @Bind("relation") int relation,
        @Bind("deleted") Boolean deleted);
  }

  interface ChangeEventDAO {
    @SqlUpdate("INSERT INTO change_event (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    default List<String> list(String eventType, List<String> entityTypes, long timestamp) {
      if (entityTypes == null || entityTypes.isEmpty()) {
        return Collections.emptyList();
      }
      if (entityTypes.get(0).equals("*")) {
        return listWithoutEntityFilter(eventType, timestamp);
      }
      return listWithEntityFilter(eventType, entityTypes, timestamp);
    }

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND (entityType IN (<entityTypes>)) AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithEntityFilter(
        @Bind("eventType") String eventType,
        @BindList("entityTypes") List<String> entityTypes,
        @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithoutEntityFilter(@Bind("eventType") String eventType, @Bind("timestamp") long timestamp);
  }
}
