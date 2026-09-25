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

package org.openmetadata.service.fernet;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.FERNET_KEY_NULL;
import static org.openmetadata.service.exception.CatalogExceptionMessage.FIELD_ALREADY_TOKENIZED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.FIELD_NOT_TOKENIZED;

import com.google.common.annotations.VisibleForTesting;
import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import com.macasaet.fernet.Validator;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.TemporalAmount;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.NonNull;
import org.openmetadata.schema.api.fernet.FernetConfiguration;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.subscription.channels.Channels;

public class Fernet {
  private static final Fernet instance = new Fernet();
  private static final String KEY_SEPARATOR = ",";
  private String fernetKey;
  private volatile List<Key> cachedKeys;
  private final SecureRandom secureRandom = new SecureRandom();
  public static final String FERNET_PREFIX = "fernet:";
  public static final String FERNET_NO_ENCRYPTION = "no_encryption_at_rest";
  private final Validator<String> validator =
      new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
          return Duration.ofSeconds(Instant.MAX.getEpochSecond());
        }
      };

  private Fernet() {
    /* Private constructor for singleton */
  }

  public static Fernet getInstance() {
    return instance;
  }

  public void setFernetKey(OpenMetadataApplicationConfig config) {
    FernetConfiguration fernetConfiguration = config.getFernetConfiguration();
    if (fernetConfiguration != null
        && !FERNET_NO_ENCRYPTION.equals(fernetConfiguration.getFernetKey())) {
      setFernetKey(fernetConfiguration.getFernetKey());
    }
  }

  @VisibleForTesting
  public void setFernetKey(String fernetKey) {
    if (fernetKey != null) {
      // convert base64 to base64url
      this.fernetKey = fernetKey.replace("/", "_").replace("+", "-").replace("=", "");
      this.cachedKeys = buildKeys(this.fernetKey);
    } else {
      this.fernetKey = null;
      this.cachedKeys = null;
    }
  }

  private static List<Key> buildKeys(String fernetKey) {
    return Arrays.stream(fernetKey.split(KEY_SEPARATOR)).map(Key::new).toList();
  }

  @VisibleForTesting
  public List<Key> getCachedKeys() {
    return cachedKeys;
  }

  public boolean isKeyDefined() {
    return fernetKey != null;
  }

  public String encrypt(@NonNull String secret) {
    if (secret.startsWith(FERNET_PREFIX)) {
      throw new IllegalArgumentException(FIELD_ALREADY_TOKENIZED);
    }
    if (isKeyDefined()) {
      Key key = cachedKeys.getFirst();
      return FERNET_PREFIX + Token.generate(secureRandom, key, secret).serialise();
    }
    throw new IllegalArgumentException(FERNET_KEY_NULL);
  }

  public static boolean isTokenized(String tokenized) {
    return tokenized != null && tokenized.startsWith(FERNET_PREFIX);
  }

  public String decrypt(String tokenized) {
    if (!isKeyDefined()) {
      throw new IllegalArgumentException(FERNET_KEY_NULL);
    }
    if (tokenized != null && tokenized.startsWith(FERNET_PREFIX)) {
      String str = tokenized.split(FERNET_PREFIX, 2)[1];
      Token token = Token.fromString(str);
      return token.validateAndDecrypt(cachedKeys, validator);
    }
    throw new IllegalArgumentException(FIELD_NOT_TOKENIZED);
  }

  /** Decrypts value without throwing an Exception in case it is not a Fernet encrypted value */
  public String decryptIfApplies(String value) {
    return Fernet.isTokenized(value) ? decrypt(value) : value;
  }

  /** Encrypt value without throwing an Exception in case it is not encrypted */
  public String encryptIfApplies(@NonNull String secret) {
    return isTokenized(secret) ? secret : encrypt(secret);
  }

  public static List<SubscriptionDestination> encryptWebhookSecretKey(
      List<SubscriptionDestination> subscriptions) {
    List<SubscriptionDestination> result = new ArrayList<>();

    subscriptions.forEach(
        subscription -> {
          Channels.ofTypeOf(subscription)
              .ifPresent(channel -> channel.configRules().encryptSecrets(subscription));

          if (nullOrEmpty(subscription.getId())) {
            subscription.withId(UUID.randomUUID());
          }

          result.add(subscription);
        });
    return result;
  }
}
