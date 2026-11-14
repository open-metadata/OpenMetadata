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

package org.openmetadata.service.fernet.rotation;

/** A place that blocks the removal of a key. It names where, never what, is stored. */
record Problem(Location at, String pointer, TokenKind kind, Outcome outcome, String detail) {

  /** For example {@code user_entity id=4f1c… json /profile/subscription/slack/endpoint: ...}. */
  String line() {
    String where = at.printable() + (pointer.isEmpty() ? "" : " " + pointer);
    return where + ": " + message();
  }

  private String message() {
    String what = kind == TokenKind.BOUND ? "bound token" : "token";
    String message =
        switch (outcome) {
          case OLDER_KEY -> what + " that only an older configured key opens";
          case NO_KEY -> what + " that no configured key opens";
          case UNBOUND -> "bound token that cannot be opened";
          case UNREWRITABLE -> what + " that will not be replaced";
          case CONTENDED -> "value that kept changing while it was re-encrypted";
          case PRIMARY, REKEYED -> what + " under the primary key";
        };
    return detail.isEmpty() ? message : message + ": " + detail;
  }
}
