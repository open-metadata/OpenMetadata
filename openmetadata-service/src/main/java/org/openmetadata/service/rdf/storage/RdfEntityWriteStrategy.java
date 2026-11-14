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

package org.openmetadata.service.rdf.storage;

/**
 * How {@link RdfStorageInterface#storeEntity} makes the stored projection of an entity match a new
 * one. Both end in the same graph; they differ in what they read and what they write.
 */
public enum RdfEntityWriteStrategy {
  /**
   * Reads what the store holds now and writes only the triples that differ, or nothing at all, then
   * reads a changed projection back and replaces it whole if a write queued ahead of it interfered.
   */
  DIFFERENCE,

  /**
   * Deletes every triple the entity's projection owns and inserts the new projection, evaluated
   * when the store applies the write. Needs no read, which is what journal replay wants.
   */
  REPLACE
}
