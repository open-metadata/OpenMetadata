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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.resources.settings.SettingsCache;

class RestUtilTest {

  @Test
  void getHrefPrefersConfiguredBaseUrlAndNormalizesPaths() {
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getBaseUri()).thenReturn(URI.create("http://localhost:8585/api/v1/"));

    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    when(config.getApiRootPath()).thenReturn("/api/v1/");

    OpenMetadataBaseUrlConfiguration baseUrlConfiguration =
        new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("https://openmetadata.example/");

    try (MockedStatic<OpenMetadataApplicationConfigHolder> configHolder =
            mockStatic(OpenMetadataApplicationConfigHolder.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      configHolder.when(OpenMetadataApplicationConfigHolder::getInstance).thenReturn(config);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                      OpenMetadataBaseUrlConfiguration.class))
          .thenReturn(baseUrlConfiguration);

      assertEquals(
          URI.create("https://openmetadata.example/api/v1/tables"),
          RestUtil.getHref(uriInfo, "/tables/"));
    }
  }

  @Test
  void getHrefFallsBackToRequestBaseUriAndAppendsEntityId() {
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getBaseUri()).thenReturn(URI.create("http://localhost:8585/api/v1/"));

    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    when(config.getApiRootPath()).thenReturn("/api/v1/");

    OpenMetadataBaseUrlConfiguration baseUrlConfiguration =
        new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("   ");
    UUID id = UUID.randomUUID();

    try (MockedStatic<OpenMetadataApplicationConfigHolder> configHolder =
            mockStatic(OpenMetadataApplicationConfigHolder.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      configHolder.when(OpenMetadataApplicationConfigHolder::getInstance).thenReturn(config);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                      OpenMetadataBaseUrlConfiguration.class))
          .thenReturn(baseUrlConfiguration);

      assertEquals(
          URI.create("http://localhost:8585/api/v1/tables/" + id),
          RestUtil.getHref(uriInfo, "tables/", id));
    }
  }

  @Test
  void dateAndCursorHelpersHandleDateOnlyValuesAndValidation() {
    assertEquals(0, RestUtil.compareDates("2024-01-01", "2024-01-01"));
    assertEquals(-1, RestUtil.compareDates("2024-01-01", "2024-01-02"));
    assertEquals(1, RestUtil.compareDates("2024-01-02", "2024-01-01"));

    assertDoesNotThrow(() -> RestUtil.validateCursors("cursor", null));
    assertThrows(IllegalArgumentException.class, () -> RestUtil.validateCursors("before", "after"));

    assertNull(RestUtil.encodeCursor(null));
    assertNull(RestUtil.decodeCursor(""));
    assertEquals(
        "service.sales.orders",
        RestUtil.decodeCursor(RestUtil.encodeCursor("service.sales.orders")));
  }

  @Test
  void responseWrappersPopulateEntitiesHeadersAndEtags() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("service.sales.orders")
            .withVersion(1.0)
            .withUpdatedAt(42L);
    ChangeEvent changeEvent = new ChangeEvent().withEntityType(Entity.TABLE);

    Response putCreated =
        new RestUtil.PutResponse<>(Response.Status.CREATED, table, EventType.ENTITY_CREATED)
            .toResponse();
    assertEquals(Response.Status.CREATED.getStatusCode(), putCreated.getStatus());
    assertEquals(table, putCreated.getEntity());
    assertEquals(
        EventType.ENTITY_CREATED.toString(),
        putCreated.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER));

    Response putUpdated =
        new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, EventType.ENTITY_DELETED)
            .toResponse();
    assertEquals(changeEvent, putUpdated.getEntity());

    Response patchResponse =
        new RestUtil.PatchResponse<>(Response.Status.OK, table, EventType.ENTITY_UPDATED)
            .toResponse();
    assertEquals(
        EventType.ENTITY_UPDATED.value(),
        patchResponse.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER));
    assertEquals(
        EntityETag.generateETag(table), patchResponse.getHeaderString(EntityETag.ETAG_HEADER));

    Response patchWithoutEntity =
        new RestUtil.PatchResponse<>(Response.Status.OK, "payload", EventType.ENTITY_UPDATED)
            .toResponse();
    assertNull(patchWithoutEntity.getHeaderString(EntityETag.ETAG_HEADER));

    Response deleteResponse =
        new RestUtil.DeleteResponse<>(table, EventType.ENTITY_DELETED).toResponse();
    assertEquals(Response.Status.OK.getStatusCode(), deleteResponse.getStatus());
    assertEquals(table, deleteResponse.getEntity());
    assertEquals(
        EventType.ENTITY_DELETED.value(),
        deleteResponse.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER));
  }

  @Test
  void timestampQuoteAndJsonHelpersHandleNestedStructuresAndInvalidInput() {
    assertThrows(
        IllegalArgumentException.class, () -> RestUtil.validateTimestampMilliseconds(null));
    assertThrows(
        BadRequestException.class, () -> RestUtil.validateTimestampMilliseconds(1_234_567_8901L));
    assertDoesNotThrow(() -> RestUtil.validateTimestampMilliseconds(1_234_567_890_123L));

    assertEquals("\"quoted\" and 'single'", RestUtil.normalizeQuotes("“quoted” and ‘single’"));

    String input =
        "prefix {\"a\":\"{literal}\",\"b\":{\"c\":1}} middle "
            + "{\"d\":\"escaped quote \\\"}\\\" stays in string\",\"e\":2} suffix {\"broken\":true";
    List<String> jsonObjects = RestUtil.extractJsonObjects(input);

    assertEquals(2, jsonObjects.size());
    assertEquals("{\"a\":\"{literal}\",\"b\":{\"c\":1}}", jsonObjects.get(0));
    assertEquals("{\"d\":\"escaped quote \\\"}\\\" stays in string\",\"e\":2}", jsonObjects.get(1));
    assertEquals(
        jsonObjects.get(0).length() - 1, RestUtil.findMatchingBrace(jsonObjects.get(0), 0));
    assertEquals(-1, RestUtil.findMatchingBrace("{\"broken\":true", 0));
  }
}
