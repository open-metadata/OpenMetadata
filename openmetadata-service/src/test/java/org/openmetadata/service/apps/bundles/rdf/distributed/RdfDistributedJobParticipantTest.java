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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;

class RdfDistributedJobParticipantTest {

  private MockedStatic<ServerIdentityResolver> serverIdentityMock;

  @BeforeEach
  void setUp() {
    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("rdf-test-server");

    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);
    RdfRepository.reset();
  }

  @AfterEach
  void tearDown() {
    RdfRepository.reset();
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void startDoesNotFailWhenRdfRepositoryIsNotInitialized() {
    RdfDistributedJobParticipant participant =
        new RdfDistributedJobParticipant(mock(CollectionDAO.class));

    assertDoesNotThrow(participant::start);
    assertDoesNotThrow(participant::stop);
  }
}
