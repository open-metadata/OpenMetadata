/*
 *  Copyright 2025 Collate
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
package org.openmetadata.sdk.test.util;

import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.test.auth.JwtAuthProvider;

/**
 * Lazily-cached {@link OpenMetadataClient} factory for integration tests. Each static accessor
 * returns a client authenticated as a distinct well-known test subject (admin, ingestion-bot,
 * data-steward, shared_user1, etc.), so tests can verify authorization and sharing without
 * managing JWTs themselves.
 *
 * <p>Base URL is resolved from the {@code IT_BASE_URL} system property or environment variable,
 * defaulting to {@code http://localhost:8585/api}.
 */
public final class SdkClients {

  private static final String BASE_URL =
      System.getProperty(
          "IT_BASE_URL", System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585/api"));

  private static volatile OpenMetadataClient ADMIN_CLIENT;
  private static volatile OpenMetadataClient TEST_USER_CLIENT;
  private static volatile OpenMetadataClient BOT_CLIENT;
  private static volatile OpenMetadataClient USER1_CLIENT;
  private static volatile OpenMetadataClient USER2_CLIENT;
  private static volatile OpenMetadataClient USER3_CLIENT;
  private static volatile OpenMetadataClient DATA_STEWARD_CLIENT;
  private static volatile OpenMetadataClient DATA_CONSUMER_CLIENT;

  private SdkClients() {}

  public static OpenMetadataClient adminClient() {
    if (ADMIN_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (ADMIN_CLIENT == null) {
          ADMIN_CLIENT = createClient("admin", "admin@open-metadata.org", new String[] {"admin"});
        }
      }
    }
    return ADMIN_CLIENT;
  }

  public static OpenMetadataClient testUserClient() {
    if (TEST_USER_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (TEST_USER_CLIENT == null) {
          TEST_USER_CLIENT = createClient("test", "test@open-metadata.org", new String[] {});
        }
      }
    }
    return TEST_USER_CLIENT;
  }

  public static OpenMetadataClient botClient() {
    if (BOT_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (BOT_CLIENT == null) {
          BOT_CLIENT =
              createClient(
                  "ingestion-bot", "ingestion-bot@open-metadata.org", new String[] {"bot"});
        }
      }
    }
    return BOT_CLIENT;
  }

  public static OpenMetadataClient ingestionBotClient() {
    return botClient();
  }

  public static OpenMetadataClient dataStewardClient() {
    if (DATA_STEWARD_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (DATA_STEWARD_CLIENT == null) {
          DATA_STEWARD_CLIENT =
              createClient(
                  "data-steward", "data-steward@open-metadata.org", new String[] {"DataSteward"});
        }
      }
    }
    return DATA_STEWARD_CLIENT;
  }

  public static OpenMetadataClient dataConsumerClient() {
    if (DATA_CONSUMER_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (DATA_CONSUMER_CLIENT == null) {
          DATA_CONSUMER_CLIENT =
              createClient(
                  "data-consumer",
                  "data-consumer@open-metadata.org",
                  new String[] {"DataConsumer"});
        }
      }
    }
    return DATA_CONSUMER_CLIENT;
  }

  public static OpenMetadataClient user1Client() {
    if (USER1_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER1_CLIENT == null) {
          USER1_CLIENT =
              createClient("shared_user1", "shared_user1@test.openmetadata.org", new String[] {});
        }
      }
    }
    return USER1_CLIENT;
  }

  public static OpenMetadataClient user2Client() {
    if (USER2_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER2_CLIENT == null) {
          USER2_CLIENT =
              createClient("shared_user2", "shared_user2@test.openmetadata.org", new String[] {});
        }
      }
    }
    return USER2_CLIENT;
  }

  public static OpenMetadataClient user3Client() {
    if (USER3_CLIENT == null) {
      synchronized (SdkClients.class) {
        if (USER3_CLIENT == null) {
          USER3_CLIENT =
              createClient("shared_user3", "shared_user3@test.openmetadata.org", new String[] {});
        }
      }
    }
    return USER3_CLIENT;
  }

  public static OpenMetadataClient createClient(String subject, String email, String[] roles) {
    String token = JwtAuthProvider.tokenFor(subject, email, roles, 3600);
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(BASE_URL)
            .accessToken(token)
            .readTimeout(300000)
            .writeTimeout(300000)
            .build();
    return new OpenMetadataClient(cfg);
  }

  public static String getServerUrl() {
    return BASE_URL;
  }

  public static String getAdminToken() {
    return JwtAuthProvider.tokenFor(
        "admin", "admin@open-metadata.org", new String[] {"admin"}, 3600);
  }
}
