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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.chat.CreateMcpMessage;
import org.openmetadata.schema.entity.chat.McpMessage;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class McpMessageRepository {
  private final CollectionDAO.McpMessageDAO dao;

  public McpMessageRepository(CollectionDAO.McpMessageDAO dao) {
    this.dao = dao;
  }

  public McpMessage create(CreateMcpMessage request, UUID conversationId, int messageIndex) {
    UUID id = UUID.randomUUID();
    McpMessage message =
        new McpMessage()
            .withId(id)
            .withConversationId(conversationId)
            .withSender(request.getSender())
            .withIndex(messageIndex)
            .withTimestamp(request.getTimestamp())
            .withContent(request.getContent())
            .withTokens(request.getTokens());
    dao.insert(JsonUtils.pojoToJson(message));
    return message;
  }

  public List<McpMessage> listByConversation(UUID conversationId, int limit, int offset) {
    List<String> rows = dao.listByConversation(conversationId, limit, offset);
    return JsonUtils.readObjects(rows, McpMessage.class);
  }

  public List<McpMessage> listRecentByConversation(UUID conversationId, int limit) {
    List<String> rows = dao.listRecentByConversation(conversationId, limit);
    List<McpMessage> messages = new ArrayList<>(JsonUtils.readObjects(rows, McpMessage.class));
    Collections.reverse(messages);
    return messages;
  }

  public int countByConversation(UUID conversationId) {
    return dao.countByConversation(conversationId);
  }

  public void delete(UUID id) {
    dao.delete(id);
  }

  public void deleteByConversation(UUID conversationId) {
    dao.deleteByConversation(conversationId);
  }
}
