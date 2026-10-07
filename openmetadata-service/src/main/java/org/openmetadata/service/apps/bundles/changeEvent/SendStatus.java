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

package org.openmetadata.service.apps.bundles.changeEvent;

import org.openmetadata.schema.entity.events.SubscriptionStatus;

/**
 * The status the send in progress on this thread left behind. A destination object is shared by
 * every target sent through it, and several may be sent to at the same time, so what one send
 * learned is kept with the thread that sent, never read back from the shared destination.
 */
public final class SendStatus {
  private static final ThreadLocal<SubscriptionStatus> OF_THIS_THREAD = new ThreadLocal<>();

  private SendStatus() {}

  static void left(SubscriptionStatus status) {
    OF_THIS_THREAD.set(status);
  }

  /** What the last send on this thread left, which is then forgotten. Null when it left nothing. */
  static SubscriptionStatus take() {
    SubscriptionStatus status = OF_THIS_THREAD.get();
    OF_THIS_THREAD.remove();
    return status;
  }
}
