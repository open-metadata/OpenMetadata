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

package org.openmetadata.it.tests.alerts;

import org.openmetadata.service.events.consumer.AbstractEventConsumer;
import org.openmetadata.service.events.consumer.ConsumerKind;
import org.openmetadata.service.events.consumer.ConsumerProvider;
import org.openmetadata.service.util.DIContainer;

/**
 * The consumers alert tests name, each registered under a {@code test.*} id of its own. The
 * published test harness carries them, so a server that loads it can build every consumer its
 * services file lists; none of them does anything until a test arms it.
 */
public final class TestConsumers {

  private TestConsumers() {}

  public static final class Latched implements ConsumerProvider {
    @Override
    public String id() {
      return LatchedConsumer.ID;
    }

    @Override
    public ConsumerKind type() {
      return ConsumerKind.EVENT;
    }

    @Override
    public AbstractEventConsumer create(DIContainer dependencies) {
      return new LatchedConsumer(dependencies);
    }
  }

  public static final class Reporting implements ConsumerProvider {
    @Override
    public String id() {
      return ReportingConsumer.ID;
    }

    @Override
    public ConsumerKind type() {
      return ConsumerKind.SELF_DRIVEN;
    }

    @Override
    public AbstractEventConsumer create(DIContainer dependencies) {
      return new ReportingConsumer(dependencies);
    }
  }

  public static final class FailingCommit implements ConsumerProvider {
    @Override
    public String id() {
      return FailingCommitConsumer.ID;
    }

    @Override
    public ConsumerKind type() {
      return ConsumerKind.EVENT;
    }

    @Override
    public AbstractEventConsumer create(DIContainer dependencies) {
      return new FailingCommitConsumer(dependencies);
    }
  }
}
