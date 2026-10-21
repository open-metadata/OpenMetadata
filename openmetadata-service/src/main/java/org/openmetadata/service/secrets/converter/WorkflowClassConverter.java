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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.TestSparkEngineConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.metadataIngestion.ReverseIngestionPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `Workflow` object. */
public class WorkflowClassConverter extends ClassConverter {

  private static final List<Class<?>> REQUEST_CLASSES =
      List.of(
          TestServiceConnectionRequest.class,
          ReverseIngestionPipeline.class,
          QueryRunnerRequest.class,
          TestSparkEngineConnectionRequest.class);

  public WorkflowClassConverter() {
    super(Workflow.class);
  }

  @Override
  public Object convert(Object object) {
    Workflow workflow = (Workflow) JsonUtils.convertValue(object, this.clazz);

    convertRequest(workflow).ifPresent(workflow::setRequest);

    if (workflow.getOpenMetadataServerConnection() != null) {
      workflow.setOpenMetadataServerConnection(
          (OpenMetadataConnection)
              ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                  .convert(workflow.getOpenMetadataServerConnection()));
    }

    return workflow;
  }

  /**
   * The workflow type names its request class, so a request that does not convert surfaces its own
   * error. Trying every request class in turn swallows that error and ends in a generic one. Only a
   * workflow without a type still falls back to guessing.
   */
  private Optional<Object> convertRequest(Workflow workflow) {
    Object request = workflow.getRequest();
    Optional<Class<?>> requestClass = requestClassFor(workflow.getWorkflowType());
    return request == null || requestClass.isEmpty()
        ? tryToConvertOrFail(request, REQUEST_CLASSES)
        : Optional.of(ClassConverterFactory.getConverter(requestClass.get()).convert(request));
  }

  private static Optional<Class<?>> requestClassFor(WorkflowType workflowType) {
    return Optional.ofNullable(workflowType)
        .map(
            type ->
                switch (type) {
                  case TEST_CONNECTION -> TestServiceConnectionRequest.class;
                  case REVERSE_INGESTION -> ReverseIngestionPipeline.class;
                  case QUERY_RUNNER -> QueryRunnerRequest.class;
                  case TEST_SPARK_ENGINE_CONNECTION -> TestSparkEngineConnectionRequest.class;
                });
  }
}
