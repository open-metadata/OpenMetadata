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

package org.openmetadata.service.util.relationshipcleanup;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class LineageRelationshipValidator implements RelationshipValidator {

  private final DefaultRelationshipValidator defaultValidator = new DefaultRelationshipValidator();

  @Override
  public ValidationResult validate(
      CollectionDAO.EntityRelationshipObject relationship,
      EntityExistenceChecker existenceChecker) {

    ValidationResult defaultResult = defaultValidator.validate(relationship, existenceChecker);
    if (defaultResult.isOrphaned()) {
      return defaultResult;
    }

    String json = relationship.getJson();
    if (json == null || json.isBlank()) {
      return ValidationResult.valid();
    }

    try {
      LineageDetails lineageDetails = JsonUtils.readValue(json, LineageDetails.class);
      EntityReference pipeline = lineageDetails.getPipeline();

      if (pipeline == null) {
        return ValidationResult.valid();
      }

      UUID pipelineId = pipeline.getId();
      if (pipelineId == null) {
        return ValidationResult.valid();
      }

      boolean pipelineExists = existenceChecker.exists(pipelineId, pipeline.getType());
      if (!pipelineExists) {
        return ValidationResult.orphaned("Pipeline entity referenced in lineage does not exist");
      }

      return ValidationResult.valid();

    } catch (Exception e) {
      LOG.debug(
          "Error parsing lineage details for relationship {}->{}: {}",
          relationship.getFromId(),
          relationship.getToId(),
          e.getMessage());
      return ValidationResult.valid();
    }
  }
}
