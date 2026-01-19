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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.McpExecutionResource;

@Slf4j
public class McpExecutionRepository extends EntityTimeSeriesRepository<McpExecution> {

  public McpExecutionRepository() {
    super(
        McpExecutionResource.COLLECTION_PATH,
        Entity.getCollectionDAO().mcpExecutionDAO(),
        McpExecution.class,
        Entity.MCP_EXECUTION);
  }

  @Override
  protected void storeRelationship(McpExecution execution) {
    EntityReference serverRef = execution.getServer();
    if (serverRef != null && serverRef.getId() != null) {
      addRelationship(
          serverRef.getId(),
          execution.getId(),
          Entity.MCP_SERVER,
          Entity.MCP_EXECUTION,
          Relationship.CONTAINS,
          null,
          false);
    }
  }

  public void deleteExecutionData(java.util.UUID serverId, Long timestamp) {
    timeSeriesDao.deleteAtTimestamp(serverId.toString(), null, timestamp);
  }
}
