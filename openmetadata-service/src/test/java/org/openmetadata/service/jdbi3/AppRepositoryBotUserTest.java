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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

class AppRepositoryBotUserTest {

  @Test
  void anAppDoesNotAdoptAPersonsAccountAsItsBot() {
    UserRepository userRepository = mock(UserRepository.class);
    BotRepository botRepository = mock(BotRepository.class);
    User person = new User().withName("reportappbot").withIsBot(false);
    when(userRepository.getByName(isNull(), eq("ReportAppBot"), any())).thenReturn(person);
    App app = new App().withName("ReportApp");
    AppRepository appRepository = mock(AppRepository.class, CALLS_REAL_METHODS);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);

      IllegalStateException refused =
          assertThrows(
              IllegalStateException.class, () -> appRepository.createNewAppBot(app, false));

      // The existing person's account is named in the error and left as a person, not promoted.
      assertTrue(refused.getMessage().contains("reportappbot"), refused.getMessage());
      assertFalse(person.getIsBot());
    }
  }
}
