/*
 *  Copyright 2025 Collate.
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

package org.openmetadata.csv;

/** Functional interface for receiving progress updates during CSV export operations. */
@FunctionalInterface
public interface CsvExportProgressCallback {
  /**
   * Called to report progress during CSV export.
   *
   * @param exported Number of entities exported so far
   * @param total Total number of entities to export
   * @param message Human-readable progress message
   */
  void onProgress(int exported, int total, String message);
}
