/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

/**
 * Why a server-side sign-in failed, as the sign-in page tells the person who tried. Only these
 * fixed codes reach the browser: what the identity provider or the server reported stays in the
 * server log (ADR:2026-11-12-a-failed-sso-sign-in-returns-to-the-sign-in-page).
 */
public enum SignInFailure {
  /** The identity provider declined the sign-in, for example with {@code access_denied}. */
  PROVIDER_REFUSED("provider_refused"),
  /** The authorization code could not be redeemed: a wrong client secret, an error or a timeout. */
  TOKEN_EXCHANGE_FAILED("token_exchange_failed"),
  /** The identity provider vouched for the person, but this deployment does not let them in. */
  ACCOUNT_NOT_ALLOWED("account_not_allowed");

  /** The sign-in page's query parameter that carries the code. */
  public static final String QUERY_PARAMETER = "error";

  private final String code;

  SignInFailure(String code) {
    this.code = code;
  }

  public String code() {
    return code;
  }

  /** This failure, with what was reported about it for the server log. */
  public SignInFailedException because(String detail, Throwable cause) {
    return new SignInFailedException(this, detail, cause);
  }
}
