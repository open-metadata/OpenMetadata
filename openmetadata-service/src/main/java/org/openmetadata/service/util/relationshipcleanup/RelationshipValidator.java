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

public interface RelationshipValidator {
  ValidationResult validate(
      CollectionDAO.EntityRelationshipObject relationship, EntityExistenceChecker existenceChecker);

  class ValidationResult {
    private final boolean isOrphaned;
    private final String reason;

    private ValidationResult(boolean isOrphaned, String reason) {
      this.isOrphaned = isOrphaned;
      this.reason = reason;
    }

    public static ValidationResult valid() {
      return new ValidationResult(false, null);
    }

    public static ValidationResult orphaned(String reason) {
      return new ValidationResult(true, reason);
    }

    public boolean isOrphaned() {
      return isOrphaned;
    }

    public String getReason() {
      return reason;
    }
  }

  @FunctionalInterface
  interface EntityExistenceChecker {
    boolean exists(UUID entityId, String entityType);
  }
}
