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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;

class PersonaContextCacheTest {

  @Test
  void releasesDistributedBuildLockWhenMaterializationFails() {
    CacheProvider provider = mock(CacheProvider.class);
    UUID personaId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    CacheKeys keys = new CacheKeys("om:test");
    Persona persona =
        new Persona()
            .withId(personaId)
            .withName("analyst")
            .withContextDefinition(new PersonaContextDefinition());

    when(provider.available()).thenReturn(true);
    when(provider.mget(anyList())).thenReturn(List.of(Optional.empty(), Optional.empty()));
    when(provider.setIfAbsent(eq(keys.personaContextLock(personaId)), any(), any(Duration.class)))
        .thenReturn(true);

    PersonaContextCache cache =
        new PersonaContextCache(provider, keys) {
          @Override
          protected PersonaContextBuilder.MaterializedPersonaContext build(Persona ignored) {
            throw new IllegalStateException("materialization failed");
          }
        };

    assertThrows(IllegalStateException.class, () -> cache.get(persona, false));
    verify(provider).deleteIfValue(eq(keys.personaContextLock(personaId)), anyString());
  }
}
