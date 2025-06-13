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

package org.openmetadata.service.resources;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.DAOFactory;

/**
 * Base class for resources that need to be aware of read/write replica database connections.
 * This class automatically selects the appropriate database connection based on the HTTP method.
 *
 * Resources that extend this class will automatically route:
 * - GET requests to the read replica (if available)
 * - POST, PUT, DELETE, PATCH requests to the primary database
 *
 * This helps improve performance by distributing read load across replicas
 * while ensuring data consistency for write operations.
 */
public abstract class ReplicaAwareResource {

  @Context private ContainerRequestContext requestContext;

  /**
   * Gets the appropriate JDBI instance based on the current HTTP method.
   *
   * @return The JDBI instance (read replica for read operations, primary for write operations)
   */
  protected Jdbi getJdbi() {
    String httpMethod = getHttpMethod();
    return DAOFactory.getDAO(Jdbi.class, httpMethod);
  }

  /**
   * Gets the HTTP method from the current request context.
   *
   * @return The HTTP method string (e.g., "GET", "POST")
   */
  protected String getHttpMethod() {
    if (requestContext != null) {
      return requestContext.getMethod();
    }
    // Default to write operation if no context available
    return "POST";
  }

  /**
   * Creates a DAO instance using the appropriate database connection
   * based on the current HTTP method.
   *
   * @param daoClass The DAO class to create
   * @param <T> The DAO type
   * @return An instance of the DAO with the appropriate database connection
   */
  protected <T> T createDAO(Class<T> daoClass) {
    return DAOFactory.getDAO(daoClass, getHttpMethod());
  }

  /**
   * Creates a DAO instance that always uses the primary database.
   * Use this for operations that must use the primary database regardless of HTTP method.
   *
   * @param daoClass The DAO class to create
   * @param <T> The DAO type
   * @return An instance of the DAO with the primary database connection
   */
  protected <T> T createPrimaryDAO(Class<T> daoClass) {
    return DAOFactory.getWriteDAO(daoClass);
  }

  /**
   * Creates a DAO instance that uses the read database connection.
   * Use this for operations that should explicitly use the read replica.
   *
   * @param daoClass The DAO class to create
   * @param <T> The DAO type
   * @return An instance of the DAO with the read database connection
   */
  protected <T> T createReadDAO(Class<T> daoClass) {
    return DAOFactory.getReadDAO(daoClass);
  }
}
