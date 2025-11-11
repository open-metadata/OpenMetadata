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

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
class RestUtilTest extends OpenMetadataApplicationTest {
  @Test
  void hrefTests() throws URISyntaxException {
    OpenMetadataBaseUrlConfiguration urlConfiguration =
        SettingsCache.getSetting(
            SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
            OpenMetadataBaseUrlConfiguration.class);

    URI baseUri = URI.create("http://base");
    assertEquals(URI.create("http://base/path"), RestUtil.getHref(baseUri, "path"));
    assertEquals(
        URI.create("http://base/path"), RestUtil.getHref(baseUri, "/path")); // Remove leading slash
    assertEquals(
        URI.create("http://base/path"),
        RestUtil.getHref(baseUri, "path/")); // Removing trailing slash
    assertEquals(
        URI.create("http://base/path"), RestUtil.getHref(baseUri, "/path/")); // Remove both slashes

    UriInfo uriInfo = mockUriInfo(urlConfiguration.getOpenMetadataUrl());
    assertEquals(
        URI.create(String.format("%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection")),
        RestUtil.getHref(uriInfo, "collection"));
    assertEquals(
        URI.create(String.format("%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection")),
        RestUtil.getHref(uriInfo, "/collection"));
    assertEquals(
        URI.create(String.format("%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection")),
        RestUtil.getHref(uriInfo, "collection/"));
    assertEquals(
        URI.create(String.format("%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection")),
        RestUtil.getHref(uriInfo, "/collection/"));

    UUID id = UUID.randomUUID();
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", id)),
        RestUtil.getHref(uriInfo, "collection", id));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", id)),
        RestUtil.getHref(uriInfo, "/collection", id));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", id)),
        RestUtil.getHref(uriInfo, "collection/", id));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", id)),
        RestUtil.getHref(uriInfo, "/collection/", id));

    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path")),
        RestUtil.getHref(uriInfo, "collection", "path"));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path")),
        RestUtil.getHref(uriInfo, "/collection", "/path"));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path")),
        RestUtil.getHref(uriInfo, "collection/", "path/"));
    assertEquals(
        URI.create(
            String.format("%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path")),
        RestUtil.getHref(uriInfo, "/collection/", "/path/"));

    assertEquals(
        URI.create(
            String.format(
                "%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path%201")),
        RestUtil.getHref(uriInfo, "collection", "path 1"));
    assertEquals(
        URI.create(
            String.format(
                "%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path%201")),
        RestUtil.getHref(uriInfo, "/collection", "/path 1"));
    assertEquals(
        URI.create(
            String.format(
                "%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path%201")),
        RestUtil.getHref(uriInfo, "collection/", "path 1/"));
    assertEquals(
        URI.create(
            String.format(
                "%s/%s/%s", urlConfiguration.getOpenMetadataUrl(), "collection", "path%201")),
        RestUtil.getHref(uriInfo, "/collection/", "/path 1/"));
  }

  private UriInfo mockUriInfo(String uri) throws URISyntaxException {
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    URI uriObject = new URI(uri);
    Mockito.when(uriInfo.getBaseUri()).thenReturn(uriObject);
    return uriInfo;
  }
}
