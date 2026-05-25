package org.openmetadata.mcp.tools;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.util.FormatterUtil;

@Slf4j
public final class McpChangeEventUtil {
  private McpChangeEventUtil() {}

  public static <T extends EntityInterface> void publishChangeEvent(
      T entity, EventType changeType, String userName) {
    if (entity == null || changeType == null || changeType.equals(EventType.ENTITY_NO_CHANGE)) {
      return;
    }
    try {
      ChangeEvent changeEvent =
          FormatterUtil.createChangeEventForEntity(userName, changeType, entity);
      changeEvent.setUserName(userName);

      if (changeEvent.getEntity() != null) {
        Object rawEntity = changeEvent.getEntity();
        ChangeEvent copy =
            org.openmetadata.service.events.ChangeEventHandler.copyChangeEvent(changeEvent);
        copy.setEntity(JsonUtils.pojoToMaskedJson(rawEntity));
        Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(copy));
      } else {
        Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
      }

      LOG.debug(
          "Published MCP change event {}:{}:{}",
          changeEvent.getEntityId(),
          changeEvent.getEventType(),
          changeEvent.getEntityType());
    } catch (Exception e) {
      LOG.error("Failed to publish MCP change event for {}", entity.getId(), e);
    }
  }
}
