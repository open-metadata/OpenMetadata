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

package org.openmetadata.service.apps.bundles.changeEvent.email;

import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.openmetadata.service.events.errors.EventPublisherException;

/** Waits for the mail server's verdict on one email, for no longer than the caller can afford. */
public final class EmailOutcome {
  private EmailOutcome() {}

  public static void await(Future<Void> outcome, Duration atMost) throws EventPublisherException {
    try {
      outcome.get(atMost.toMillis(), TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new EventPublisherException("Interrupted while waiting for the mail server");
    } catch (TimeoutException e) {
      throw new EventPublisherException(
          "The mail server did not answer within " + atMost.toSeconds() + " seconds");
    } catch (ExecutionException e) {
      throw new EventPublisherException(
          "The mail server rejected the email: " + e.getCause().getMessage());
    }
  }
}
