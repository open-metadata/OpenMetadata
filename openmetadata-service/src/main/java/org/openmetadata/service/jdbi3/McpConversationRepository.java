/*
 *  Copyright 2025 Collate.
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

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.chat.CreateMcpConversation;
import org.openmetadata.schema.entity.chat.McpConversation;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;

@Slf4j
public class McpConversationRepository {
  private final CollectionDAO.McpConversationDAO dao;

  public McpConversationRepository(CollectionDAO.McpConversationDAO dao) {
    this.dao = dao;
  }

  public McpConversation create(CreateMcpConversation request, EntityReference user) {
    UUID id = UUID.randomUUID();
    long now = System.currentTimeMillis();
    McpConversation conversation =
        new McpConversation()
            .withId(id)
            .withUser(user)
            .withCreatedAt(now)
            .withUpdatedAt(now)
            .withCreatedBy(user.getName())
            .withUpdatedBy(user.getName())
            .withTitle(request.getTitle())
            .withMessageCount(0);
    dao.insert(JsonUtils.pojoToJson(conversation));
    return conversation;
  }

  public McpConversation getById(UUID id) {
    String json = dao.getById(id);
    if (json == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityNotFound("McpConversation", id.toString()));
    }
    return JsonUtils.readValue(json, McpConversation.class);
  }

  public List<McpConversation> listByUser(UUID userId, int limit, int offset) {
    List<String> rows = dao.listByUser(userId, limit, offset);
    return JsonUtils.readObjects(rows, McpConversation.class);
  }

  public McpConversation update(McpConversation conversation) {
    conversation.setUpdatedAt(System.currentTimeMillis());
    dao.update(conversation.getId(), JsonUtils.pojoToJson(conversation));
    return conversation;
  }

  public int countByUser(UUID userId) {
    return dao.countByUser(userId);
  }

  public void delete(UUID id) {
    dao.delete(id);
  }
}
