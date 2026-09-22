package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
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
          "INSERT INTO onboarding_instance (id,entityId,entityType,configurationId,stage,createdAt,enteredAt,revision,json) VALUES (:id,:entityId,:entityType,:configurationId,:stage,:createdAt,:enteredAt,0,:json)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO onboarding_instance (id,entityId,entityType,configurationId,stage,createdAt,enteredAt,revision,json) VALUES (:id,:entityId,:entityType,:configurationId,:stage,:createdAt,:enteredAt,0,:json::jsonb)",
      connectionType = POSTGRES)
  void insert(
      @Bind("id") String id,
      @Bind("entityId") String entityId,
      @Bind("entityType") String entityType,
      @Bind("configurationId") String configurationId,
      @Bind("stage") String stage,
      @Bind("createdAt") Long createdAt,
      @Bind("enteredAt") Long enteredAt,
      @BindJson("json") String json);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE onboarding_instance SET json=:json, stage=:stage, enteredAt=:enteredAt, revision=revision+1 WHERE entityId=:entityId AND revision=:revision",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE onboarding_instance SET json=:json::jsonb, stage=:stage, enteredAt=:enteredAt, revision=revision+1 WHERE entityId=:entityId AND revision=:revision",
      connectionType = POSTGRES)
  int update(
      @Bind("entityId") String entityId,
      @Bind("stage") String stage,
      @Bind("enteredAt") Long enteredAt,
      @Bind("revision") long revision,
      @BindJson("json") String json);

  @SqlQuery(
      "SELECT json FROM onboarding_instance WHERE (:entityType IS NULL OR entityType=:entityType) AND (:stage IS NULL OR stage=:stage) AND id > :after ORDER BY id LIMIT :limit")
  List<String> list(
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("after") String after,
      @Bind("limit") int limit);

  /** Board rows for a known set of assets - a list page hydrates its visible rows in one read. */
  @SqlQuery(
      "SELECT json FROM onboarding_instance WHERE (:entityType IS NULL OR entityType=:entityType) AND entityId IN (<entityIds>) ORDER BY id")
  List<String> listByEntityIds(
      @Bind("entityType") String entityType, @BindList("entityIds") List<String> entityIds);

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

  /**
   * Stage timings, appended in the same transaction as the instance JSON. Re-running a synchronize
   * after a retry replays the same stay, so the insert is written to ignore the duplicate rather
   * than fail the transaction that carries the instance update.
   */
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT IGNORE INTO onboarding_stage_history (id,instanceId,entityType,stage,enteredAt,exitedAt) VALUES (:id,:instanceId,:entityType,:stage,:enteredAt,:exitedAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO onboarding_stage_history (id,instanceId,entityType,stage,enteredAt,exitedAt) VALUES (:id,:instanceId,:entityType,:stage,:enteredAt,:exitedAt) ON CONFLICT DO NOTHING",
      connectionType = POSTGRES)
  void insertStageTiming(
      @Bind("id") String id,
      @Bind("instanceId") String instanceId,
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("enteredAt") long enteredAt,
      @Bind("exitedAt") long exitedAt);

  @SqlUpdate("DELETE FROM onboarding_stage_history WHERE instanceId=:instanceId")
  void deleteStageHistory(@Bind("instanceId") String instanceId);

  @SqlUpdate(
      "INSERT INTO onboarding_reminder (id,instanceId,entityType,stepId,taskId,kind,sentAt,sentBy) VALUES (:id,:instanceId,:entityType,:stepId,:taskId,:kind,:sentAt,:sentBy)")
  void insertReminder(
      @Bind("id") String id,
      @Bind("instanceId") String instanceId,
      @Bind("entityType") String entityType,
      @Bind("stepId") String stepId,
      @Bind("taskId") String taskId,
      @Bind("kind") String kind,
      @Bind("sentAt") long sentAt,
      @Bind("sentBy") String sentBy);

  @SqlUpdate("DELETE FROM onboarding_reminder WHERE instanceId=:instanceId")
  void deleteReminders(@Bind("instanceId") String instanceId);

  @SqlQuery(
      "SELECT COUNT(*) FROM onboarding_reminder WHERE entityType=:entityType AND kind=:kind AND sentAt >= :from AND sentAt < :to")
  int countReminders(
      @Bind("entityType") String entityType,
      @Bind("kind") String kind,
      @Bind("from") long from,
      @Bind("to") long to);

  @SqlQuery(
      "SELECT MAX(sentAt) FROM onboarding_reminder WHERE instanceId=:instanceId AND stepId=:stepId AND kind=:kind")
  Long lastReminderAt(
      @Bind("instanceId") String instanceId,
      @Bind("stepId") String stepId,
      @Bind("kind") String kind);

  @SqlQuery(
      "SELECT COUNT(*) FROM onboarding_instance WHERE entityType=:entityType AND createdAt >= :from AND createdAt < :to")
  int countCohort(
      @Bind("entityType") String entityType, @Bind("from") long from, @Bind("to") long to);

  /** How many of a creation cohort left {@code stage} within {@code withinMillis} of creation. */
  @SqlQuery(
      "SELECT COUNT(*) FROM onboarding_instance i WHERE i.entityType=:entityType AND i.createdAt >= :from AND i.createdAt < :to"
          + " AND EXISTS (SELECT 1 FROM onboarding_stage_history h WHERE h.instanceId = i.id AND h.stage = :stage AND h.exitedAt <= i.createdAt + :withinMillis)")
  int countCohortAdvancedInTime(
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("from") long from,
      @Bind("to") long to,
      @Bind("withinMillis") long withinMillis);

  @SqlQuery(
      "SELECT COUNT(*) FROM onboarding_stage_history WHERE entityType=:entityType AND stage=:stage AND exitedAt >= :from AND exitedAt < :to")
  int countStageDurations(
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("from") long from,
      @Bind("to") long to);

  /**
   * Stage durations around the middle of the sorted sample. Only the one or two rows a median needs
   * are read, so a long window never materializes the whole population.
   */
  @SqlQuery(
      "SELECT (exitedAt - enteredAt) FROM onboarding_stage_history WHERE entityType=:entityType AND stage=:stage AND exitedAt >= :from AND exitedAt < :to"
          + " ORDER BY (exitedAt - enteredAt) LIMIT :limit OFFSET :offset")
  List<Long> listStageDurations(
      @Bind("entityType") String entityType,
      @Bind("stage") String stage,
      @Bind("from") long from,
      @Bind("to") long to,
      @Bind("offset") int offset,
      @Bind("limit") int limit);

  /**
   * Open onboarding tasks whose asset has not moved for a while. The marker column keeps a pass
   * idempotent: a task that already produced this reminder is filtered in SQL rather than reloaded.
   */
  @SqlQuery(
      "SELECT t.taskId FROM onboarding_task t JOIN onboarding_instance i ON i.id = t.instanceId JOIN task_entity e ON e.id = t.taskId"
          + " WHERE i.entityType = :entityType AND e.status IN (<statuses>) AND e.updatedAt < :threshold AND t.stallNotifiedAt IS NULL"
          + " ORDER BY e.updatedAt LIMIT :limit")
  List<String> listStallNotifiable(
      @Bind("entityType") String entityType,
      @BindList("statuses") List<String> statuses,
      @Bind("threshold") long threshold,
      @Bind("limit") int limit);

  @SqlQuery(
      "SELECT t.taskId FROM onboarding_task t JOIN onboarding_instance i ON i.id = t.instanceId JOIN task_entity e ON e.id = t.taskId"
          + " WHERE i.entityType = :entityType AND e.status IN (<statuses>) AND e.updatedAt < :threshold AND t.reassignedAt IS NULL"
          + " ORDER BY e.updatedAt LIMIT :limit")
  List<String> listReassignable(
      @Bind("entityType") String entityType,
      @BindList("statuses") List<String> statuses,
      @Bind("threshold") long threshold,
      @Bind("limit") int limit);

  @SqlUpdate(
      "UPDATE onboarding_task SET stallNotifiedAt=:at WHERE taskId=:taskId AND stallNotifiedAt IS NULL")
  int markStallNotified(@Bind("taskId") String taskId, @Bind("at") long at);

  @SqlUpdate(
      "UPDATE onboarding_task SET reassignedAt=:at WHERE taskId=:taskId AND reassignedAt IS NULL")
  int markReassigned(@Bind("taskId") String taskId, @Bind("at") long at);

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
