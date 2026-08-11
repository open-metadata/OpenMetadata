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

package org.openmetadata.service.migration.api;

import java.util.Optional;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * SPI for resolving a {@link MigrationProcess} for migration directories that ship outside of
 * OpenMetadata. Commercial distributions or downstream forks register implementations via
 * {@code META-INF/services/org.openmetadata.service.migration.api.MigrationProcessExtensionProvider}
 * to plug in their own Java migration classes without OpenMetadata having to know about them.
 *
 * <p>The migration workflow only consults providers for files where {@code MigrationFile.isExtension}
 * is true. If no provider returns a present value, the workflow falls back to {@link
 * MigrationProcessImpl}, which runs the SQL changes from the version's directory and performs no
 * Java-level data migration.
 */
public interface MigrationProcessExtensionProvider {

  /**
   * Resolve a migration process for the given extension migration file.
   *
   * @param file the extension migration file (guaranteed {@code file.isExtension == true})
   * @return the {@link MigrationProcess} to run for this version, or {@link Optional#empty()} if
   *     this provider does not handle the version (the workflow will try the next provider, or
   *     fall back to {@link MigrationProcessImpl}).
   */
  Optional<MigrationProcess> provide(MigrationFile file);
}
