/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.security.policyevaluator;

import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.ConversationReply;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Authorization attributes for a conversation reply. */
public record ConversationReplyResourceContext(Conversation conversation, ConversationReply reply)
    implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.CONVERSATION;
  }

  @Override
  public List<EntityReference> getOwners() {
    return reply == null || reply.getAuthor() == null
        ? Collections.emptyList()
        : List.of(reply.getAuthor());
  }

  @Override
  public List<TagLabel> getTags() {
    return Collections.emptyList();
  }

  @Override
  public EntityInterface getEntity() {
    return null;
  }

  @Override
  public List<EntityReference> getDomains() {
    return conversation == null || conversation.getDomains() == null
        ? Collections.emptyList()
        : conversation.getDomains();
  }
}
