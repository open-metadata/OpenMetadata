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

import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

@Slf4j
class RestUtilTest {
  @Test
  void hrefTests() throws URISyntaxException {
    URI baseUri = URI.create("http://base");
    assertEquals(URI.create("http://base/path"), RestUtil.getHref(baseUri, "path"));
    assertEquals(URI.create("http://base/path"), RestUtil.getHref(baseUri, "/path")); // Remove leading slash
    assertEquals(URI.create("http://base/path"), RestUtil.getHref(baseUri, "path/")); // Removing trailing slash
    assertEquals(URI.create("http://base/path"), RestUtil.getHref(baseUri, "/path/")); // Remove both slashes

    UriInfo uriInfo = mockUriInfo("http://base/");
    assertEquals(URI.create("http://base/collection"), RestUtil.getHref(uriInfo, "collection"));
    assertEquals(URI.create("http://base/collection"), RestUtil.getHref(uriInfo, "/collection"));
    assertEquals(URI.create("http://base/collection"), RestUtil.getHref(uriInfo, "collection/"));
    assertEquals(URI.create("http://base/collection"), RestUtil.getHref(uriInfo, "/collection/"));

    UUID id = UUID.randomUUID();
    assertEquals(URI.create("http://base/collection/" + id), RestUtil.getHref(uriInfo, "collection", id));
    assertEquals(URI.create("http://base/collection/" + id), RestUtil.getHref(uriInfo, "/collection", id));
    assertEquals(URI.create("http://base/collection/" + id), RestUtil.getHref(uriInfo, "collection/", id));
    assertEquals(URI.create("http://base/collection/" + id), RestUtil.getHref(uriInfo, "/collection/", id));

    assertEquals(URI.create("http://base/collection/path"), RestUtil.getHref(uriInfo, "collection", "path"));
    assertEquals(URI.create("http://base/collection/path"), RestUtil.getHref(uriInfo, "/collection", "/path"));
    assertEquals(URI.create("http://base/collection/path"), RestUtil.getHref(uriInfo, "collection/", "path/"));
    assertEquals(URI.create("http://base/collection/path"), RestUtil.getHref(uriInfo, "/collection/", "/path/"));

    assertEquals(URI.create("http://base/collection/path%201"), RestUtil.getHref(uriInfo, "collection", "path 1"));
    assertEquals(URI.create("http://base/collection/path%201"), RestUtil.getHref(uriInfo, "/collection", "/path 1"));
    assertEquals(URI.create("http://base/collection/path%201"), RestUtil.getHref(uriInfo, "collection/", "path 1/"));
    assertEquals(URI.create("http://base/collection/path%201"), RestUtil.getHref(uriInfo, "/collection/", "/path 1/"));
  }

  private UriInfo mockUriInfo(String uri) throws URISyntaxException {
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    URI uriObject = new URI(uri);
    Mockito.when(uriInfo.getBaseUri()).thenReturn(uriObject);
    return uriInfo;
  }
}
