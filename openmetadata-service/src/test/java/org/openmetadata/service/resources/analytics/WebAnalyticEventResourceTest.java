/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.analytics.CustomEvent;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;

class WebAnalyticEventResourceTest {

  @Test
  void removeNullCharactersReturnsNullForNullInput() {
    assertNull(WebAnalyticEventResource.removeNullCharacters(null));
  }

  @Test
  void removeNullCharactersReturnsSameStringWhenNoNulPresent() {
    String input = "Settings/Preferences/Health Check";
    assertEquals(input, WebAnalyticEventResource.removeNullCharacters(input));
  }

  @Test
  void removeNullCharactersStripsAllNulCharacters() {
    String input = "Unexpected executed migrations [2.0.0]\n\u0000\u0000tail";
    String expected = "Unexpected executed migrations [2.0.0]\ntail";
    assertEquals(expected, WebAnalyticEventResource.removeNullCharacters(input));
  }

  @Test
  void sanitizeCustomEventStripsNulFromUserSuppliedFields() {
    CustomEvent customEvent =
        new CustomEvent()
            .withEventType(CustomEvent.CustomEventTypes.CLICK)
            .withFullUrl("https://example.com/page\u0000")
            .withUrl("/page\u0000")
            .withHostname("example.com\u0000")
            .withEventValue("Health Check\u0000Failed\u0000");

    WebAnalyticEventData input =
        new WebAnalyticEventData()
            .withTimestamp(1779107588156L)
            .withEventType(WebAnalyticEventType.CUSTOM_EVENT)
            .withEventData(customEvent);

    WebAnalyticEventData result = WebAnalyticEventResource.sanitizeWebAnalyticEventData(input);

    CustomEvent sanitized = (CustomEvent) result.getEventData();
    assertFalse(sanitized.getFullUrl().contains("\u0000"));
    assertFalse(sanitized.getUrl().contains("\u0000"));
    assertFalse(sanitized.getHostname().contains("\u0000"));
    assertFalse(sanitized.getEventValue().contains("\u0000"));
    assertEquals("Health CheckFailed", sanitized.getEventValue());
  }

  @Test
  void sanitizePageViewStripsNulFromUserSuppliedFields() {
    PageViewData pageView =
        new PageViewData()
            .withFullUrl("https://example.com/page\u0000")
            .withUrl("/page\u0000")
            .withHostname("example.com\u0000")
            .withLanguage("en-US\u0000")
            .withScreenSize("1920x1080\u0000")
            .withReferrer("https://referrer.com\u0000");

    WebAnalyticEventData input =
        new WebAnalyticEventData()
            .withTimestamp(1779107588156L)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(pageView);

    WebAnalyticEventData result = WebAnalyticEventResource.sanitizeWebAnalyticEventData(input);

    PageViewData sanitized = (PageViewData) result.getEventData();
    assertFalse(sanitized.getFullUrl().contains("\u0000"));
    assertFalse(sanitized.getUrl().contains("\u0000"));
    assertFalse(sanitized.getHostname().contains("\u0000"));
    assertFalse(sanitized.getLanguage().contains("\u0000"));
    assertFalse(sanitized.getScreenSize().contains("\u0000"));
    assertFalse(sanitized.getReferrer().contains("\u0000"));
  }
}
