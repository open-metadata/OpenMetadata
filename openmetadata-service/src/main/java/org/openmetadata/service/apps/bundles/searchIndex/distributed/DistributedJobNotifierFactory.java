/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Factory for creating the DistributedJobNotifier used by search indexing.
 */
@Slf4j
public class DistributedJobNotifierFactory {

  private DistributedJobNotifierFactory() {
    // Utility class
  }

  /**
   * Create a DistributedJobNotifier.
   *
   * @param collectionDAO The DAO for database access
   * @param serverId The current server's ID
   * @return The notifier implementation
   */
  public static DistributedJobNotifier create(CollectionDAO collectionDAO, String serverId) {
    LOG.info("Using database polling for distributed search indexing job discovery");
    return new PollingJobNotifier(collectionDAO, serverId);
  }
}
