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

package org.openmetadata.service.logging;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.access.common.spi.IAccessEvent;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.LoggerContextVO;
import ch.qos.logback.core.LayoutBase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.logging.common.DropwizardLayout;
import io.dropwizard.logging.json.layout.AccessJsonLayout;
import io.dropwizard.logging.json.layout.EventJsonLayout;
import io.dropwizard.request.logging.layout.LogbackAccessRequestLayout;
import java.util.Collections;
import java.util.Map;
import java.util.TimeZone;
import org.junit.jupiter.api.Test;

class SwitchableLayoutFactoryTest {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

  @Test
  void buildsTextEventLayoutWithConfiguredPattern() {
    SwitchableEventLayoutFactory factory = new SwitchableEventLayoutFactory();
    factory.setPattern("%msg%n");

    LayoutBase<ILoggingEvent> layout = factory.build(new LoggerContext(), UTC);

    assertInstanceOf(DropwizardLayout.class, layout);
    assertEquals("%msg%n", ((DropwizardLayout) layout).getPattern());
  }

  @Test
  void buildsJsonEventLayoutWithAdditionalFields() throws Exception {
    SwitchableEventLayoutFactory factory = new SwitchableEventLayoutFactory();
    factory.setFormat(" JSON ");
    factory.setAppendLineSeparator(false);
    factory.setAdditionalFields(Map.of("service", "openmetadata"));

    LayoutBase<ILoggingEvent> layout = factory.build(new LoggerContext(), UTC);
    layout.start();

    String rendered = layout.doLayout(mockLoggingEvent());
    JsonNode json = OBJECT_MAPPER.readTree(rendered);

    assertInstanceOf(EventJsonLayout.class, layout);
    assertEquals("hello world", json.get("message").asText());
    assertEquals("INFO", json.get("level").asText());
    assertEquals("openmetadata", json.get("service").asText());
    assertFalse(rendered.endsWith("\n"));
    assertFalse(rendered.endsWith("\r\n"));
  }

  @Test
  void factoryGettersReturnConfiguredValues() {
    SwitchableEventLayoutFactory factory = new SwitchableEventLayoutFactory();
    factory.setFormat("json");
    factory.setAppendLineSeparator(false);
    factory.setPattern("%msg%n");
    factory.setAdditionalFields(Map.of("env", "test"));

    assertEquals("json", factory.getFormat());
    assertFalse(factory.isAppendLineSeparator());
    assertEquals("%msg%n", factory.getPattern());
    assertEquals(Map.of("env", "test"), factory.getAdditionalFields());
  }

  @Test
  void rejectsUnsupportedEventFormat() {
    SwitchableEventLayoutFactory factory = new SwitchableEventLayoutFactory();
    factory.setFormat("xml");

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> factory.build(new LoggerContext(), UTC));

    assertEquals(
        "Unsupported log format 'xml'. Expected one of [text, json].", exception.getMessage());
  }

  @Test
  void buildsTextAccessLayoutWithConfiguredPattern() {
    SwitchableAccessLayoutFactory factory = new SwitchableAccessLayoutFactory();
    factory.setPattern("%requestURL %statusCode%n");

    LayoutBase<IAccessEvent> layout = factory.build(new LoggerContext(), UTC);

    assertInstanceOf(LogbackAccessRequestLayout.class, layout);
    assertEquals("%requestURL %statusCode%n", ((LogbackAccessRequestLayout) layout).getPattern());
  }

  @Test
  void buildsJsonAccessLayoutWithAdditionalFields() throws Exception {
    SwitchableAccessLayoutFactory factory = new SwitchableAccessLayoutFactory();
    factory.setFormat("json");
    factory.setAppendLineSeparator(false);
    factory.setAdditionalFields(Map.of("service", "openmetadata"));

    LayoutBase<IAccessEvent> layout = factory.build(new LoggerContext(), UTC);
    layout.start();

    String rendered = layout.doLayout(mockAccessEvent());
    JsonNode json = OBJECT_MAPPER.readTree(rendered);

    assertInstanceOf(AccessJsonLayout.class, layout);
    assertEquals("GET", json.get("method").asText());
    assertEquals(200, json.get("status").asInt());
    assertEquals("openmetadata", json.get("service").asText());
    assertFalse(rendered.endsWith("\n"));
    assertFalse(rendered.endsWith("\r\n"));
  }

  @Test
  void rejectsUnsupportedAccessFormat() {
    SwitchableAccessLayoutFactory factory = new SwitchableAccessLayoutFactory();
    factory.setFormat("yaml");

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> factory.build(new LoggerContext(), UTC));

    assertEquals(
        "Unsupported access log format 'yaml'. Expected one of [text, json].",
        exception.getMessage());
  }

  private ILoggingEvent mockLoggingEvent() {
    LoggerContext loggerContext = new LoggerContext();
    loggerContext.setName("openmetadata");

    ILoggingEvent event = mock(ILoggingEvent.class);
    when(event.getTimeStamp()).thenReturn(1_700_000_000_000L);
    when(event.getLevel()).thenReturn(Level.INFO);
    when(event.getThreadName()).thenReturn("main");
    when(event.getLoggerName())
        .thenReturn("org.openmetadata.service.logging.SwitchableLayoutFactoryTest");
    when(event.getMessage()).thenReturn("hello world");
    when(event.getFormattedMessage()).thenReturn("hello world");
    when(event.getLoggerContextVO()).thenReturn(new LoggerContextVO(loggerContext));
    when(event.getThrowableProxy()).thenReturn(null);
    when(event.getMarkerList()).thenReturn(Collections.emptyList());
    when(event.getMDCPropertyMap()).thenReturn(Map.of("cluster", "openmetadata"));
    when(event.getCallerData()).thenReturn(new StackTraceElement[0]);
    return event;
  }

  private IAccessEvent mockAccessEvent() {
    IAccessEvent event = mock(IAccessEvent.class);
    when(event.getTimeStamp()).thenReturn(1_700_000_000_000L);
    when(event.getLocalPort()).thenReturn(8585);
    when(event.getContentLength()).thenReturn(128L);
    when(event.getMethod()).thenReturn("GET");
    when(event.getProtocol()).thenReturn("HTTP/1.1");
    when(event.getRequestContent()).thenReturn("");
    when(event.getRemoteAddr()).thenReturn("127.0.0.1");
    when(event.getRemoteUser()).thenReturn("admin");
    when(event.getRequestParameterMap()).thenReturn(Map.of("id", new String[] {"1"}));
    when(event.getElapsedTime()).thenReturn(15L);
    when(event.getRequestURI()).thenReturn("/api/v1/test");
    when(event.getRequestURL()).thenReturn("http://localhost:8585/api/v1/test");
    when(event.getQueryString()).thenReturn("id=1");
    when(event.getRemoteHost()).thenReturn("localhost");
    when(event.getResponseContent()).thenReturn("");
    when(event.getServerName()).thenReturn("localhost");
    when(event.getStatusCode()).thenReturn(200);
    when(event.getRequestHeader("User-Agent")).thenReturn("JUnit");
    return event;
  }
}
