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

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.alerting.content.template.HandlebarsNotificationTemplateProcessor;
import org.slf4j.LoggerFactory;

class UnsupportedNotificationTemplatesTest {

  private static final String UNSUPPORTED_BODY = "{{> fragment}}";
  private static final String SUPPORTED_BODY =
      "{{entity.name}} {{#each entity.tags}}{{this}}{{/each}}";

  private final List<String> resetTemplates = new ArrayList<>();
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
  void anUnsupportedUserTemplateIsNamedAndKept() {
    review(template("uses-a-partial", ProviderType.USER, UNSUPPORTED_BODY));

    assertEquals(List.of(), resetTemplates);
    assertEquals(1, appender.list.size());
    assertEquals(Level.WARN, appender.list.getFirst().getLevel());
    assertTrue(appender.list.getFirst().getFormattedMessage().contains("uses-a-partial"));
    assertTrue(
        appender.list.getFirst().getFormattedMessage().contains("Partials are not supported"));
  }

  @Test
  void anUnsupportedSystemTemplateIsResetToItsDefault() {
    review(template("system-notification-entity-updated", ProviderType.SYSTEM, UNSUPPORTED_BODY));

    assertEquals(List.of("system-notification-entity-updated"), resetTemplates);
    assertEquals(1, appender.list.size());
    assertTrue(appender.list.getFirst().getFormattedMessage().contains("reset to its default"));
  }

  @Test
  void supportedTemplatesAreLeftAlone() {
    review(template("reads-data", ProviderType.USER, SUPPORTED_BODY));
    review(template("system-notification-entity-created", ProviderType.SYSTEM, SUPPORTED_BODY));

    assertEquals(List.of(), resetTemplates);
    assertEquals(List.of(), appender.list);
  }

  @Test
  void aSystemTemplateWithoutAPackagedDefaultIsNamedAndKept() {
    Consumer<NotificationTemplate> noDefault =
        template -> {
          throw new IllegalArgumentException("Default template not found in seed data");
        };

    new UnsupportedNotificationTemplates(new HandlebarsNotificationTemplateProcessor(), noDefault)
        .review(template("system-notification-retired", ProviderType.SYSTEM, UNSUPPORTED_BODY));

    assertEquals(1, appender.list.size());
    assertEquals(Level.ERROR, appender.list.getFirst().getLevel());
    assertTrue(
        appender.list.getFirst().getFormattedMessage().contains("system-notification-retired"));
  }

  private void review(NotificationTemplate template) {
    new UnsupportedNotificationTemplates(
            new HandlebarsNotificationTemplateProcessor(),
            stored -> resetTemplates.add(stored.getFullyQualifiedName()))
        .review(template);
  }

  private static NotificationTemplate template(String name, ProviderType provider, String body) {
    return new NotificationTemplate()
        .withName(name)
        .withFullyQualifiedName(name)
        .withProvider(provider)
        .withTemplateSubject("subject")
        .withTemplateBody(body);
  }
}
