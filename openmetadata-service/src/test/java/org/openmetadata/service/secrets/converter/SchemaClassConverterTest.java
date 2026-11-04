package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.services.connections.dashboard.SapS4HanaConnection;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.nats.NatsBasicAuth;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.LoggerFactory;

class SchemaClassConverterTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"username\":\"u\",\"pasword\":\"secret\"}",
        "{\"username\":\"u\",\"password\":null,\"obsolete\":true}"
      })
  void incompleteSecretCannotUseLenientFallback(String json) {
    Map<?, ?> auth = JsonUtils.readValue(json, Map.class);

    assertThrows(
        IllegalArgumentException.class,
        () -> ClassConverterFactory.convertProperty(NatsConnection.class, "authType", auth));
  }

  @Test
  void completeSecretCanDiscardAnObsoleteField() {
    Map<String, Object> auth = Map.of("username", "u", "password", "secret", "obsolete", true);

    NatsBasicAuth converted =
        assertInstanceOf(
            NatsBasicAuth.class,
            ClassConverterFactory.convertProperty(NatsConnection.class, "authType", auth));

    assertEquals("u", converted.getUsername());
    assertEquals("secret", converted.getPassword());
    assertFalse(JsonUtils.pojoToJson(converted).contains("obsolete"));
  }

  @Test
  void failedLenientConversionDoesNotLogCredentials() {
    String secret = "credential-in-rejected-uri";
    Map<String, Object> auth =
        Map.of(
            "authType",
            "oauth2",
            "clientId",
            "client",
            "clientSecret",
            secret,
            "tokenEndpoint",
            "https://user:" + secret + "@example.com/invalid path");
    Logger logger = (Logger) LoggerFactory.getLogger(SchemaClassConverter.class);
    Level previousLevel = logger.getLevel();
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    logger.setLevel(Level.DEBUG);
    try {
      assertThrows(
          IllegalArgumentException.class,
          () -> ClassConverterFactory.convertProperty(SapS4HanaConnection.class, "authType", auth));

      assertFalse(appender.list.isEmpty());
      for (ILoggingEvent event : appender.list) {
        assertFalse(event.getFormattedMessage().contains(secret));
        assertNull(event.getThrowableProxy(), "logged causes can contain rejected credentials");
      }
      assertTrue(
          appender.list.stream()
              .anyMatch(
                  event ->
                      event.getLevel() == Level.DEBUG
                          && event.getFormattedMessage().contains("SapS4HanaOAuthCredentials")
                          && event.getFormattedMessage().contains("IllegalArgumentException")));
    } finally {
      logger.setLevel(previousLevel);
      logger.detachAppender(appender);
      appender.stop();
    }
  }
}
