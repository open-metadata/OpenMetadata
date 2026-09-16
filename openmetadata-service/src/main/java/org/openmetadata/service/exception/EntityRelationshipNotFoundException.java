/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.exception;

/**
 * Raised when an entity is missing a relationship it is required to have — i.e. a
 * {@code mustHaveRelationship} lookup found no {@code entity_relationship} row. This is a narrow
 * subtype of {@link UnhandledServerException} so callers (notably the delete path) can tolerate a
 * genuinely dangling required reference without swallowing unrelated {@code UnhandledServerException}s
 * (which this codebase also uses to wrap arbitrary failures). It preserves the parent's HTTP 500
 * status, error code, and message wrapping, so existing {@code catch (UnhandledServerException)} and
 * message-based handlers continue to work unchanged.
 */
public class EntityRelationshipNotFoundException extends UnhandledServerException {
  public EntityRelationshipNotFoundException(String exceptionMessage) {
    super(exceptionMessage);
  }
}
