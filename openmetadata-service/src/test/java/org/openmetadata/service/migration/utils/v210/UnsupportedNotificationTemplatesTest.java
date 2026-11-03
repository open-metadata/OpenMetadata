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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.service.alerting.content.template.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.alerting.content.template.NotificationTemplateProcessor;
import org.slf4j.LoggerFactory;

class UnsupportedNotificationTemplatesTest {

  private final NotificationTemplateProcessor processor =
      new HandlebarsNotificationTemplateProcessor();
  private final Logger logger =
      (Logger) LoggerFactory.getLogger(UnsupportedNotificationTemplates.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

  @BeforeEach
  void captureLog() {
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void releaseLog() {
    logger.detachAppender(appender);
  }

  @Test
  void namesATemplateWithAnUnsupportedConstruct() {
    UnsupportedNotificationTemplates.logIfUnsupported(
        processor, template("uses-a-partial", "{{> fragment}}"));

    List<ILoggingEvent> warnings = appender.list;
    assertEquals(1, warnings.size());
    assertTrue(warnings.getFirst().getFormattedMessage().contains("uses-a-partial"));
    assertTrue(warnings.getFirst().getFormattedMessage().contains("Partials are not supported"));
  }

  @Test
  void leavesASupportedTemplateUnnamed() {
    UnsupportedNotificationTemplates.logIfUnsupported(
        processor,
        template("reads-data", "{{entity.name}} {{#each entity.tags}}{{this}}{{/each}}"));

    assertEquals(List.of(), appender.list);
  }

  private static NotificationTemplate template(String name, String body) {
    return new NotificationTemplate()
        .withName(name)
        .withFullyQualifiedName(name)
        .withTemplateSubject("subject")
        .withTemplateBody(body);
  }
}
