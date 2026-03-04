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
import org.openmetadata.service.jdbi3.CollectionDAO;

public class DefaultRelationshipValidator implements RelationshipValidator {

  @Override
  public ValidationResult validate(
      CollectionDAO.EntityRelationshipObject relationship,
      EntityExistenceChecker existenceChecker) {
    UUID fromId = UUID.fromString(relationship.getFromId());
    UUID toId = UUID.fromString(relationship.getToId());
    String fromEntity = relationship.getFromEntity();
    String toEntity = relationship.getToEntity();

    boolean fromExists = existenceChecker.exists(fromId, fromEntity);
    boolean toExists = existenceChecker.exists(toId, toEntity);

    if (fromExists && toExists) {
      return ValidationResult.valid();
    }

    if (!fromExists && !toExists) {
      return ValidationResult.orphaned("Both fromEntity and toEntity do not exist");
    } else if (!fromExists) {
      return ValidationResult.orphaned("fromEntity does not exist");
    } else {
      return ValidationResult.orphaned("toEntity does not exist");
    }
  }
}
