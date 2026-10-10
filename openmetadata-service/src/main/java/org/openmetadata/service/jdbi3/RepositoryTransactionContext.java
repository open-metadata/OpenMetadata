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

import java.util.Objects;

final class RepositoryTransactionContext {
  private static final ThreadLocal<CollectionDAO> CURRENT_DAO = new ThreadLocal<>();

  private RepositoryTransactionContext() {}

  static CollectionDAO currentDAO() {
    return CURRENT_DAO.get();
  }

  static CollectionDAO requireCurrentDAO() {
    CollectionDAO currentDAO = currentDAO();
    if (currentDAO == null) {
      throw new IllegalStateException("No repository transaction is active");
    }
    return currentDAO;
  }

  static void runWith(CollectionDAO transactionDAO, Runnable operation) {
    CollectionDAO previousDAO = CURRENT_DAO.get();
    CURRENT_DAO.set(Objects.requireNonNull(transactionDAO));
    try {
      operation.run();
    } finally {
      restore(previousDAO);
    }
  }

  private static void restore(CollectionDAO previousDAO) {
    if (previousDAO == null) {
      CURRENT_DAO.remove();
    } else {
      CURRENT_DAO.set(previousDAO);
    }
  }
}
