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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class StartupTimerTest {
  private Logger logger;
  private ListAppender<ILoggingEvent> appender;

  @BeforeEach
  void setUp() {
    logger = (Logger) LoggerFactory.getLogger(StartupTimer.class);
    appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void tearDown() {
    logger.detachAppender(appender);
  }

  @Test
  void timeReturnsWorkResultAndLogsSummarySlowestFirst() {
    AtomicLong nanoTime = new AtomicLong();
    StartupTimer timer = new StartupTimer(nanoTime::get);

    String result =
        timer.time(
            "fast",
            () -> {
              nanoTime.addAndGet(TimeUnit.MILLISECONDS.toNanos(25));
              return "result";
            });
    timer.time(
        "slow",
        () -> {
          nanoTime.addAndGet(TimeUnit.MILLISECONDS.toNanos(50));
        });

    timer.logSummary();

    assertEquals("result", result);
    assertEquals(
        List.of("Startup step 'slow' took 50 ms", "Startup step 'fast' took 25 ms"),
        appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .filter(message -> message.startsWith("Startup step"))
            .toList());
  }
}
