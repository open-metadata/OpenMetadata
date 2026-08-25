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
import org.openmetadata.schema.entity.ai.AgentExecution;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AgentExecutionResource;

@Slf4j
public class AgentExecutionRepository extends EntityTimeSeriesRepository<AgentExecution> {

  public AgentExecutionRepository() {
    super(
        AgentExecutionResource.COLLECTION_PATH,
        Entity.getCollectionDAO().agentExecutionDAO(),
        AgentExecution.class,
        Entity.AGENT_EXECUTION);
  }

  @Override
  protected void storeRelationship(AgentExecution execution) {
    EntityReference agentRef = execution.getAgent();
    if (agentRef != null && agentRef.getId() != null) {
      addRelationship(
          agentRef.getId(),
          execution.getId(),
          Entity.AI_APPLICATION,
          Entity.AGENT_EXECUTION,
          Relationship.CONTAINS,
          null,
          false);
    }
  }

  public void deleteExecutionData(java.util.UUID agentId, Long timestamp) {
    // Use timeSeriesDao to delete execution data at specific timestamp
    // extension is null for AgentExecution (no extension used)
    timeSeriesDao.deleteAtTimestamp(agentId.toString(), null, timestamp);
  }
}
