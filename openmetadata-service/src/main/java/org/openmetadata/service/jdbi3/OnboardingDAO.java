package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindJson;

public interface OnboardingDAO {
  @SqlQuery("SELECT json FROM onboarding_instance WHERE entityId = :entityId")
  String find(@Bind("entityId") String entityId);

  @SqlQuery("SELECT json FROM onboarding_instance WHERE entityId = :entityId FOR UPDATE")
  String lock(@Bind("entityId") String entityId);

  @SqlQuery(
      "SELECT i.json FROM onboarding_instance i JOIN onboarding_task t ON i.id = t.instanceId WHERE t.taskId = :taskId")
  String findByTask(@Bind("taskId") String taskId);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO onboarding_instance (id,entityId,entityType,configurationId,stage,revision,json) VALUES (:id,:entityId,:entityType,:configurationId,:stage,0,:json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO onboarding_instance (id,entityId,entityType,configurationId,stage,revision,json) VALUES (:id,:entityId,:entityType,:configurationId,:stage,0,:json::jsonb)",
      connectionType = POSTGRES)
  void insert(
      @Bind("id") String id,
      @Bind("entityId") String entityId,
      @Bind("entityType") String entityType,
      @Bind("configurationId") String configurationId,
      @Bind("stage") String stage,
      @BindJson("json") String json);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE onboarding_instance SET json=:json, stage=:stage, revision=revision+1 WHERE entityId=:entityId AND revision=:revision",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE onboarding_instance SET json=:json::jsonb, stage=:stage, revision=revision+1 WHERE entityId=:entityId AND revision=:revision",
      connectionType = POSTGRES)
  int update(
      @Bind("entityId") String entityId,
      @Bind("stage") String stage,
      @Bind("revision") long revision,
      @BindJson("json") String json);

  @SqlQuery(
      "SELECT json FROM onboarding_instance WHERE (:entityType IS NULL OR entityType=:entityType) AND (:stage IS NULL OR stage=:stage) AND id > :after ORDER BY id LIMIT :limit")
  List<String> list(
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("after") String after,
      @Bind("limit") int limit);

  @SqlUpdate(
      "INSERT INTO onboarding_task (taskId,instanceId,stepId,attempt) VALUES (:taskId,:instanceId,:stepId,:attempt)")
  void bindTask(
      @Bind("taskId") String taskId,
      @Bind("instanceId") String instanceId,
      @Bind("stepId") String stepId,
      @Bind("attempt") int attempt);

  @SqlUpdate("DELETE FROM onboarding_task WHERE instanceId=:id")
  void deleteTasks(@Bind("id") String id);

  @SqlUpdate("DELETE FROM onboarding_instance WHERE entityId=:entityId")
  void delete(@Bind("entityId") String entityId);

  @SqlQuery("SELECT json FROM onboarding_backfill WHERE configurationId=:id")
  String getBackfill(@Bind("id") String id);

  @SqlUpdate(
      "UPDATE onboarding_backfill SET leaseOwner=:owner, leaseUntil=:until WHERE configurationId=:id AND leaseUntil < :now")
  int claimBackfill(
      @Bind("id") String id,
      @Bind("owner") String owner,
      @Bind("now") long now,
      @Bind("until") long until);

  @SqlUpdate(
      "UPDATE onboarding_backfill SET leaseOwner=NULL, leaseUntil=0 WHERE configurationId=:id AND leaseOwner=:owner")
  void releaseBackfill(@Bind("id") String id, @Bind("owner") String owner);

  @ConnectionAwareSqlUpdate(
      value = "INSERT INTO onboarding_backfill (configurationId,json) VALUES (:id,:json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value = "INSERT INTO onboarding_backfill (configurationId,json) VALUES (:id,:json::jsonb)",
      connectionType = POSTGRES)
  void insertBackfill(@Bind("id") String id, @BindJson("json") String json);

  @ConnectionAwareSqlUpdate(
      value = "UPDATE onboarding_backfill SET json=:json WHERE configurationId=:id",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value = "UPDATE onboarding_backfill SET json=:json::jsonb WHERE configurationId=:id",
      connectionType = POSTGRES)
  void updateBackfill(@Bind("id") String id, @BindJson("json") String json);
}
