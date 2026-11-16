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

package org.openmetadata.mcp.tools;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * A memory answer checks whether each Query it cites still exists before deciding how to show it.
 * Tests that mock {@link Entity} stub that lookup here so the caller's view permission decides.
 */
final class CitedQueries {

  private CitedQueries() {}

  @SuppressWarnings({"rawtypes", "unchecked"})
  static void stillExist(MockedStatic<Entity> entities) {
    EntityDAO queries = mock(EntityDAO.class);
    when(queries.exists(any(), any())).thenReturn(true);
    EntityRepository repository = mock(EntityRepository.class);
    when(repository.getDao()).thenReturn(queries);
    entities.when(() -> Entity.getEntityRepository(Entity.QUERY)).thenReturn(repository);
  }
}
