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

package org.openmetadata.service.resources.governance;

import org.openmetadata.schema.api.governance.CreateIntakeForm;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.service.mapper.EntityMapper;

public class IntakeFormMapper implements EntityMapper<IntakeForm, CreateIntakeForm> {
  @Override
  public IntakeForm createToEntity(CreateIntakeForm create, String user) {
    return copy(new IntakeForm(), create, user)
        .withEntityType(create.getEntityType())
        .withEnabled(create.getEnabled() == null ? Boolean.TRUE : create.getEnabled())
        .withRequiredFields(create.getRequiredFields())
        .withFullyQualifiedName(create.getName());
  }
}
