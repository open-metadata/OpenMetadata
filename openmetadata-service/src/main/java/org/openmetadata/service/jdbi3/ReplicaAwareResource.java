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

package org.openmetadata.service.jdbi3;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import lombok.extern.slf4j.Slf4j;

/**
 * Base class for resources that need to use replica-aware DAOs.
 * Provides utility methods to get the appropriate DAO based on the HTTP method.
 */
@Slf4j
public abstract class ReplicaAwareResource {

  @Context private ContainerRequestContext requestContext;

  /**
   * Get the HTTP method of the current request.
   * @return HTTP method string (GET, POST, PUT, DELETE, PATCH)
   */
  protected String getHttpMethod() {
    if (requestContext != null) {
      return requestContext.getMethod();
    }
    // Fallback - this should not normally happen
    LOG.warn("Unable to determine HTTP method from request context. Using POST as default.");
    return "POST";
  }

  /**
   * Get CollectionDAO instance based on the current HTTP method.
   * @return Appropriate CollectionDAO instance
   */
  protected CollectionDAO getCollectionDAO() {
    return DAOFactory.getCollectionDAO(getHttpMethod());
  }

  /**
   * Get CollectionDAO for read operations (uses replica if available).
   * @return CollectionDAO instance for read operations
   */
  protected CollectionDAO getReadCollectionDAO() {
    return DAOFactory.getReadCollectionDAO();
  }

  /**
   * Get CollectionDAO for write operations (always uses primary).
   * @return CollectionDAO instance for write operations
   */
  protected CollectionDAO getWriteCollectionDAO() {
    return DAOFactory.getWriteCollectionDAO();
  }

  /**
   * Get any DAO instance based on the current HTTP method.
   * @param daoClass The DAO class to instantiate
   * @param <T> The DAO type
   * @return DAO instance
   */
  protected <T> T getDAO(Class<T> daoClass) {
    return DAOFactory.getDAO(daoClass, getHttpMethod());
  }

  /**
   * Get DAO for read operations.
   * @param daoClass The DAO class to instantiate
   * @param <T> The DAO type
   * @return DAO instance for read operations
   */
  protected <T> T getReadDAO(Class<T> daoClass) {
    return DAOFactory.getReadDAO(daoClass);
  }

  /**
   * Get DAO for write operations.
   * @param daoClass The DAO class to instantiate
   * @param <T> The DAO type
   * @return DAO instance for write operations
   */
  protected <T> T getWriteDAO(Class<T> daoClass) {
    return DAOFactory.getWriteDAO(daoClass);
  }
}
