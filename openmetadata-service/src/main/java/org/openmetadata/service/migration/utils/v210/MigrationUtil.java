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
package org.openmetadata.service.migration.utils.v210;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {

  private static final String FLOWABLE_EVENT_SUBSCRIPTION_TABLE = "ACT_RU_EVENT_SUBSCR";
  private static final String ACTIVITY_ID_COLUMN = "ACTIVITY_ID_";
  private static final int REQUIRED_ACTIVITY_ID_LENGTH = 255;

  private static final String WIDEN_ACTIVITY_ID_MYSQL =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR MODIFY COLUMN ACTIVITY_ID_ varchar(255)";
  private static final String WIDEN_ACTIVITY_ID_POSTGRES =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR ALTER COLUMN ACTIVITY_ID_ TYPE varchar(255)";

  private static final String COLUMN_LENGTH_MYSQL =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = DATABASE() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";
  private static final String COLUMN_LENGTH_POSTGRES =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = current_schema() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";

  private MigrationUtil() {}

  /**
   * Restore the activity-id width OpenMetadata's governance workflows need.
   *
   * <p>Flowable declares {@code ACT_RU_EVENT_SUBSCR.ACTIVITY_ID_} as {@code varchar(64)}. Workflow
   * activity ids generated here are longer than that, so migration 1.6.0 — which used to create
   * Flowable's schema by hand — declared the column at {@code varchar(255)}. Flowable now creates
   * and versions that schema itself, so the widening has to be re-applied or the first workflow
   * signal fails with a data-truncation error.
   *
   * <p>Deliberately Java rather than SQL: the table only exists once Flowable has initialized, and
   * that initialization is allowed to fail without aborting a migration. A plain {@code ALTER} in a
   * SQL file would turn that tolerated failure into a hard stop, so the column is inspected first
   * and left alone when Flowable has not created its schema (yet) or the width is already correct.
   */
  public static void widenFlowableActivityId(Handle handle, ConnectionType connectionType) {
    Integer currentLength = currentActivityIdLength(handle, connectionType);
    if (currentLength == null) {
      LOG.info(
          "{} not present — Flowable has not created its schema; skipping activity id widening",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE);
    } else if (currentLength >= REQUIRED_ACTIVITY_ID_LENGTH) {
      LOG.debug("{} already at {} characters", ACTIVITY_ID_COLUMN, currentLength);
    } else {
      LOG.info(
          "Widening {}.{} from {} to {} characters",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE,
          ACTIVITY_ID_COLUMN,
          currentLength,
          REQUIRED_ACTIVITY_ID_LENGTH);
      handle.execute(
          connectionType == ConnectionType.MYSQL
              ? WIDEN_ACTIVITY_ID_MYSQL
              : WIDEN_ACTIVITY_ID_POSTGRES);
    }
  }

  /**
   * Deploy stored workflow definitions that never reached Flowable.
   *
   * <p>A definition only reaches the engine through the create/update hooks on its repository, and
   * boot-time seeding calls create only for entities that do not exist yet. When a migration
   * created them first, seeding skips them and nothing deploys them — the definition sits in the
   * database and the first attempt to run it fails with "Process Definition not found". Migration
   * 1.13.1 used to cover this by redeploying everything on the way past; consolidating the pre-2.0
   * migrations into the baseline removed the only step that guaranteed it.
   *
   * <p>Only the missing ones are deployed. Redeploying indiscriminately supersedes the process
   * definition of every live workflow and resets the timer jobs behind periodic ones, which stops
   * them firing — so an already-deployed workflow is left exactly as it is.
   */
  public static int deployMissingGovernanceWorkflows() {
    int deployed = 0;
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowHandler handler = WorkflowHandler.getInstance();
    for (WorkflowDefinition definition :
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter())) {
      deployed += deployIfMissing(handler, definition);
    }
    LOG.info("Deployed {} previously undeployed governance workflow definition(s)", deployed);
    return deployed;
  }

  /** One failure must not stop the rest: a single bad definition should not block the upgrade. */
  private static int deployIfMissing(WorkflowHandler handler, WorkflowDefinition definition) {
    int deployed = 0;
    try {
      if (!handler.isDeployed(definition)) {
        handler.deploy(new Workflow(definition));
        LOG.info("Deployed missing workflow '{}'", definition.getName());
        deployed = 1;
      }
    } catch (RuntimeException e) {
      LOG.warn("Failed to deploy workflow '{}': {}", definition.getName(), e.getMessage());
    }
    return deployed;
  }

  private static Integer currentActivityIdLength(Handle handle, ConnectionType connectionType) {
    String query =
        connectionType == ConnectionType.MYSQL ? COLUMN_LENGTH_MYSQL : COLUMN_LENGTH_POSTGRES;
    return handle
        .createQuery(query)
        .bind("tableName", FLOWABLE_EVENT_SUBSCRIPTION_TABLE)
        .bind("columnName", ACTIVITY_ID_COLUMN)
        .mapTo(Integer.class)
        .findOne()
        .orElse(null);
  }
}
