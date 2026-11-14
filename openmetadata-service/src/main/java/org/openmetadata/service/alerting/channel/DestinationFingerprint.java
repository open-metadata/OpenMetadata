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

package org.openmetadata.service.alerting.channel;

import java.util.List;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * Which settings a destination held, so a verdict reached on them can tell whether they have
 * changed since. It is taken from the destination as stored, secrets still encrypted, and never
 * decrypts, so no secret is ever hashed: a value entered in place of one that does not open is
 * stored as new ciphertext and changes it, while a save that sends the mask back, or a value the
 * stored ciphertext opens to, keeps the stored ciphertext and leaves it as it was. Its id, status
 * and whether it is switched on are not settings.
 */
public final class DestinationFingerprint {
  private static final List<String> NOT_SETTINGS = List.of("id", "statusDetails", "enabled");

  private DestinationFingerprint() {}

  /** SHA-256, in hex, of the destination's settings as stored. */
  public static String of(SubscriptionDestination asStored) {
    return DigestUtils.sha256Hex(DestinationContent.canonical(asStored, NOT_SETTINGS).toString());
  }
}
