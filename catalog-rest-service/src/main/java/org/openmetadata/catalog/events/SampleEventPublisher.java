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

package org.openmetadata.catalog.events;

import java.util.Map;
import javax.ws.rs.ProcessingException;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.type.ChangeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SampleEventPublisher implements EventPublisher {
  private static final Logger LOG = LoggerFactory.getLogger(SampleEventPublisher.class);

  public void init(Map<String, Object> config, Jdbi jdbi) {
    LOG.info("in init");
  }

  @Override
  public void onStart() {
    LOG.info("Sample-EventPublisher-lifecycle-onStart");
  }

  @Override
  public void publish(ChangeEvent event) {
    LOG.info("log event {}", event);
  }

  @Override
  public void onEvent(EventPubSub.ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch)
      throws Exception {
    // Ignore events that don't match the webhook event filters
    ChangeEvent changeEvent = changeEventHolder.get();
    long attemptTime = System.currentTimeMillis();
    try {
      publish(changeEvent);
    } catch (ProcessingException ex) {
      LOG.error("error", ex);
    }
  }

  @Override
  public void onShutdown() {
    close();
    LOG.info("Sample-EventPublisher-lifecycle-onShutdown");
  }

  @Override
  public void close() {}
}
