package org.openmetadata.it.util;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.UUID;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;

/**
 * Changes entities the way a governance workflow does: in-process, as the governance bot. For tests
 * that need an entity in a lifecycle stage an active workflow owns, since a direct API edit of such
 * a stage is rejected and not every stage has a workflow path that reaches it.
 */
public final class GovernanceWorkflowActions {
  private GovernanceWorkflowActions() {}

  public static void moveToStage(String entityType, UUID id, EntityStatus stage) {
    JsonPatch patch =
        Json.createPatchBuilder().add("/" + Entity.FIELD_ENTITY_STATUS, stage.value()).build();
    Entity.getEntityRepository(entityType)
        .patch(null, id, WorkflowEventConsumer.GOVERNANCE_BOT, patch);
  }
}
