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

package org.openmetadata.it.util;

import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.services.teams.UserService;

/**
 * Helpers for ensuring well-known test users exist before permission tests run.
 *
 * <p>Permission ITs that present a JWT for a not-yet-created user hit
 * {@code SubjectCache.getUserContext}, which throws {@code EntityNotFoundException}
 * (mapped to 404) and short-circuits the authorizer before it can return the expected
 * 403. Calling {@link #ensureExists} from {@code @BeforeAll} pins the user into the
 * DB so that authorization runs against the real subject deterministically.
 *
 * <p>Unlike the fluent-API-based {@code UserTestFactory}, this helper uses
 * {@code UserService} directly to avoid the fluent-API initialization ordering that
 * only happens when an admin client is built first.
 */
public final class TestUsers {

  public static final String DATA_CONSUMER_NAME = "data-consumer";
  public static final String DATA_CONSUMER_EMAIL = "data-consumer@open-metadata.org";

  private static final int HTTP_NOT_FOUND = 404;
  private static final int HTTP_CONFLICT = 409;

  private TestUsers() {}

  /**
   * Ensure a user with the given name + email exists. Idempotent and safe to call
   * concurrently from multiple {@code @BeforeAll} methods — 404 on lookup falls
   * through to create; 409 on create is tolerated (another caller won the race).
   * Any other status code propagates immediately so misconfigured setups fail fast
   * rather than masking later 404s.
   */
  public static void ensureExists(String name, String email) {
    UserService userService = new UserService(SdkClients.adminClient().getHttpClient());
    try {
      userService.getByName(name, null);
    } catch (OpenMetadataException notFound) {
      if (notFound.getStatusCode() != HTTP_NOT_FOUND) {
        throw notFound;
      }
      try {
        userService.create(new CreateUser().withName(name).withEmail(email));
      } catch (OpenMetadataException conflict) {
        if (conflict.getStatusCode() != HTTP_CONFLICT) {
          throw conflict;
        }
      }
    }
  }

  /** Ensure the well-known {@code data-consumer} user exists. */
  public static void ensureDataConsumer() {
    ensureExists(DATA_CONSUMER_NAME, DATA_CONSUMER_EMAIL);
  }
}
