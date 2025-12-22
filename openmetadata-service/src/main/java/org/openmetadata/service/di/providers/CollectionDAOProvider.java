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

package org.openmetadata.service.di.providers;

import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Provider interface for CollectionDAO instances.
 *
 * <p>This interface allows different implementations (OpenMetadata vs Collate) to provide their own
 * CollectionDAO implementations via dependency injection.
 *
 * <p>OpenMetadata provides the default CollectionDAO, while Collate can provide DaoExtension which
 * extends CollectionDAO with additional methods.
 *
 * <p>Example usage:
 *
 * <pre>
 * // OpenMetadata implementation
 * public class DefaultCollectionDAOProvider implements CollectionDAOProvider {
 *   public CollectionDAO getCollectionDAO(Jdbi jdbi) {
 *     return jdbi.onDemand(CollectionDAO.class);
 *   }
 * }
 *
 * // Collate implementation
 * public class CollateCollectionDAOProvider implements CollectionDAOProvider {
 *   public CollectionDAO getCollectionDAO(Jdbi jdbi) {
 *     return jdbi.onDemand(DaoExtension.class);
 *   }
 * }
 * </pre>
 */
public interface CollectionDAOProvider {
  /**
   * Get CollectionDAO instance from JDBI.
   *
   * @param jdbi JDBI instance
   * @return CollectionDAO instance (may be CollectionDAO or a subclass like DaoExtension)
   */
  CollectionDAO getCollectionDAO(Jdbi jdbi);
}
