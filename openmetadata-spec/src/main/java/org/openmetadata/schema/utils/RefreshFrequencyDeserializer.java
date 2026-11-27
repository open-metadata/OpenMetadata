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

package org.openmetadata.schema.utils;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.DeserializationConfig;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.deser.BeanDeserializerModifier;
import com.fasterxml.jackson.databind.deser.std.DelegatingDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.util.TokenBuffer;
import java.io.IOException;
import org.openmetadata.schema.api.data.RefreshFrequency;

/** Keeps refresh frequency intervals exact at Jackson's input boundary before integer coercion. */
public final class RefreshFrequencyDeserializer extends DelegatingDeserializer {
  private static final String INTERVAL = "interval";
  private static final String UNIT = "unit";

  private RefreshFrequencyDeserializer(JsonDeserializer<?> delegate) {
    super(delegate);
  }

  public static SimpleModule module() {
    return new SimpleModule("OpenMetadataRefreshFrequencyModule")
        .setDeserializerModifier(
            new BeanDeserializerModifier() {
              @Override
              public JsonDeserializer<?> modifyDeserializer(
                  DeserializationConfig config,
                  BeanDescription bean,
                  JsonDeserializer<?> deserializer) {
                return bean.getBeanClass() == RefreshFrequency.class
                    ? new RefreshFrequencyDeserializer(deserializer)
                    : deserializer;
              }
            });
  }

  @Override
  protected JsonDeserializer<?> newDelegatingInstance(JsonDeserializer<?> delegate) {
    return new RefreshFrequencyDeserializer(delegate);
  }

  @Override
  public Object deserialize(JsonParser parser, DeserializationContext context) throws IOException {
    Object result;
    if (!parser.isExpectedStartObjectToken()) {
      result = super.deserialize(parser, context);
    } else {
      try (TokenBuffer buffer = context.bufferForInputBuffering(parser)) {
        readAndValidate(parser, context, buffer);
        try (JsonParser replay = buffer.asParserOnFirstToken()) {
          result = super.deserialize(replay, context);
        }
      }
    }
    return result;
  }

  private static void readAndValidate(
      JsonParser parser, DeserializationContext context, TokenBuffer buffer) throws IOException {
    boolean isMinute = false;
    boolean hasInterval = false;
    boolean hasExactInterval = false;
    buffer.copyCurrentEvent(parser);
    while (parser.nextToken() == JsonToken.FIELD_NAME) {
      String field = parser.currentName();
      buffer.copyCurrentEvent(parser);
      parser.nextToken();
      if (UNIT.equals(field)) {
        isMinute = RefreshFrequency.Unit.MINUTE.value().equals(parser.getValueAsString());
      } else if (INTERVAL.equals(field)) {
        hasInterval = parser.currentToken() != JsonToken.VALUE_NULL;
        hasExactInterval = isExactInteger(parser);
      }
      buffer.copyCurrentStructure(parser);
    }
    buffer.copyCurrentEvent(parser);
    if ((isMinute || hasInterval) && !hasExactInterval) {
      context.reportInputMismatch(
          RefreshFrequency.class,
          "The refresh frequency interval must be a whole number in the 32-bit integer range.");
    }
  }

  private static boolean isExactInteger(JsonParser parser) throws IOException {
    JsonToken token = parser.currentToken();
    boolean exact = false;
    if (token != null && token.isNumeric() && !parser.isNaN()) {
      try {
        parser.getDecimalValue().intValueExact();
        exact = true;
      } catch (ArithmeticException e) {
        exact = false;
      }
    }
    return exact;
  }
}
