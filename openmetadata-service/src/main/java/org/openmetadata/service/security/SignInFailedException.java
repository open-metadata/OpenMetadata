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

/** A server-side sign-in that failed for a reason the sign-in page can name. */
public final class SignInFailedException extends RuntimeException {
  private final SignInFailure failure;

  SignInFailedException(SignInFailure failure, String detail, Throwable cause) {
    super(detail, cause);
    this.failure = failure;
  }

  public SignInFailure failure() {
    return failure;
  }
}
