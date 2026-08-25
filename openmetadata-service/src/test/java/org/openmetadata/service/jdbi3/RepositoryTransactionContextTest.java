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

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

class RepositoryTransactionContextTest {

  @Test
  void restoresThePreviousContextAfterNestedScopesAndFailures() {
    CollectionDAO outerDAO = mock(CollectionDAO.class);
    CollectionDAO innerDAO = mock(CollectionDAO.class);

    RepositoryTransactionContext.runWith(
        outerDAO,
        () -> {
          assertSame(outerDAO, RepositoryTransactionContext.currentDAO());
          assertSame(outerDAO, RepositoryTransactionContext.requireCurrentDAO());
          assertThrows(
              IllegalStateException.class,
              () ->
                  RepositoryTransactionContext.runWith(
                      innerDAO,
                      () -> {
                        assertSame(innerDAO, RepositoryTransactionContext.currentDAO());
                        assertSame(innerDAO, RepositoryTransactionContext.requireCurrentDAO());
                        throw new IllegalStateException("mutation failed");
                      }));
          assertSame(outerDAO, RepositoryTransactionContext.requireCurrentDAO());
        });

    assertNull(RepositoryTransactionContext.currentDAO());
    assertThrows(IllegalStateException.class, RepositoryTransactionContext::requireCurrentDAO);
  }
}
