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
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.util.JsonUtils;

/** Converter class to get an `Workflow` object. */
public class WorkflowClassConverter extends ClassConverter {

  public WorkflowClassConverter() {
    super(Workflow.class);
  }

  @Override
  public Object convert(Object object) {
    Workflow workflow = (Workflow) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(workflow.getRequest(), List.of(TestServiceConnectionRequest.class))
        .ifPresent(workflow::setRequest);

    workflow.setOpenMetadataServerConnection(
        (OpenMetadataConnection)
            ClassConverterFactory.getConverter(OpenMetadataConnection.class)
                .convert(workflow.getOpenMetadataServerConnection()));

    return workflow;
  }
}
