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

package org.openmetadata.service.clients.pipeline.noop;

import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.operations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.operations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.sdk.exception.PipelineServiceClientException;

public class NoopClient extends PipelineServiceClient {

  String EXCEPTION_MSG = "The NoopClient does not implement the %s method";

  public NoopClient(PipelineServiceClientConfiguration pipelineServiceClientConfiguration) {
    super(pipelineServiceClientConfiguration);
  }

  @Override
  public Response getServiceStatus() {
    return null;
  }

  @Override
  public Response testConnection(TestServiceConnectionRequest testServiceConnection) {
    return null;
  }

  @Override
  public Response runOperationsWorkflow(Workflow workflow) {
    return null;
  }

  @Override
  public String deployPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    throw new PipelineServiceClientException(String.format(EXCEPTION_MSG, "deploy"));
  }

  @Override
  public String runPipeline(IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    throw new PipelineServiceClientException(String.format(EXCEPTION_MSG, "run"));
  }

  @Override
  public String deletePipeline(IngestionPipeline ingestionPipeline) {
    throw new PipelineServiceClientException(String.format(EXCEPTION_MSG, "delete"));
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatus(IngestionPipeline ingestionPipeline) {
    return null;
  }

  @Override
  public IngestionPipeline toggleIngestion(IngestionPipeline ingestionPipeline) {
    throw new PipelineServiceClientException(String.format(EXCEPTION_MSG, "toggle"));
  }

  @Override
  public Map<String, String> getLastIngestionLogs(IngestionPipeline ingestionPipeline, String after) {
    return null;
  }

  @Override
  public Response killIngestion(IngestionPipeline ingestionPipeline) {
    throw new PipelineServiceClientException(String.format(EXCEPTION_MSG, "kill"));
  }

  @Override
  public Map<String, String> requestGetHostIp() {
    return null;
  }
}
