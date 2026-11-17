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

package org.openmetadata.service.secrets.converter;

import java.util.Map;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.TestSparkEngineConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.metadataIngestion.ReverseIngestionPipeline;
import org.openmetadata.schema.utils.JsonUtils;

/** Supplies the owner context missing from the request union. */
public final class WorkflowClassConverter extends ClassConverter {
  WorkflowClassConverter(SchemaClassConverter engine) {
    super(Workflow.class, engine);
  }

  @Override
  public Object convert(Object object) {
    try {
      return super.convert(object);
    } catch (SchemaConversionException failure) {
      Map<?, ?> raw = JsonUtils.convertValue(object, Map.class);
      if (requestClass(raw.get("workflowType")) == TestServiceConnectionRequest.class) {
        throw TestServiceConnectionRequestClassConverter.invalidConnection(
            raw.get("request"), failure);
      }
      throw failure;
    }
  }

  static Class<?> requestClass(Object type) {
    if (type == null) {
      return null;
    }
    try {
      return switch (WorkflowType.fromValue(type.toString())) {
        case TEST_CONNECTION -> TestServiceConnectionRequest.class;
        case REVERSE_INGESTION -> ReverseIngestionPipeline.class;
        case QUERY_RUNNER -> QueryRunnerRequest.class;
        case TEST_SPARK_ENGINE_CONNECTION -> TestSparkEngineConnectionRequest.class;
      };
    } catch (IllegalArgumentException failure) {
      throw new SchemaConversionException("Field 'workflowType' is not an allowed schema value");
    }
  }
}
