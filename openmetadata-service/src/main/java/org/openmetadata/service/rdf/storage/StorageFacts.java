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
 * The RDF store's data volume as the store reports it: total and free bytes, and whether its write
 * guard is refusing writes because free space fell below its reserve.
 */
public record StorageFacts(long totalBytes, long usableBytes, boolean lowOnSpace) {
  /** Free space as a whole percentage of the volume. */
  public int freePercent() {
    return totalBytes <= 0 ? 100 : (int) (usableBytes * 100 / totalBytes);
  }
}
