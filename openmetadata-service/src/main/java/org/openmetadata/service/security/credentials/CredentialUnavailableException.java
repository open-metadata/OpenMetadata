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

package org.openmetadata.service.security.credentials;

/**
 * The verifier could not confirm whether a token is current: the database read failed, timed out,
 * or no request-read permit was obtained within {@code loadTimeout}. Distinct from
 * {@link org.openmetadata.service.security.AuthenticationException}, which means the token is
 * confirmed not current. Callers must not treat this as "revoked" (a retry may succeed) and must
 * never treat it as "valid" (fail closed).
 */
public final class CredentialUnavailableException extends RuntimeException {
  private final long retryAfterSeconds;

  public CredentialUnavailableException(String message, long retryAfterSeconds, Throwable cause) {
    super(message, cause);
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Seconds a client should wait before it retries: the verifier's sweep interval, rounded up. */
  public long retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
