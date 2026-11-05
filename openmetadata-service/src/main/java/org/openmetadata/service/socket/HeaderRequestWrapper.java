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

package org.openmetadata.service.socket;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Overlays the handshake identity the filter validated on top of the client's headers. HTTP header
 * names are case-insensitive, so overrides and suppressions match that way: a client cannot slip a
 * {@code userid} past a {@code UserId} override.
 */
public class HeaderRequestWrapper extends HttpServletRequestWrapper {

  public HeaderRequestWrapper(HttpServletRequest request) {
    super(request);
  }

  private final Map<String, String> headerMap = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
  private final Set<String> suppressed = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);

  public void addHeader(String name, String value) {
    suppressed.remove(name);
    headerMap.put(name, value);
  }

  /**
   * Hides the client's values for a header entirely: it is absent from every accessor until {@link
   * #addHeader} sets a validated value. Used for identity headers the handshake could not establish,
   * so the client's own value never reaches the servlet behind the filter.
   */
  public void removeHeader(String name) {
    headerMap.remove(name);
    suppressed.add(name);
  }

  @Override
  public String getHeader(String name) {
    if (suppressed.contains(name)) {
      return null;
    }
    if (headerMap.containsKey(name)) {
      return headerMap.get(name);
    }
    return super.getHeader(name);
  }

  @Override
  public Enumeration<String> getHeaderNames() {
    Set<String> names = new LinkedHashSet<>();
    Enumeration<String> clientNames = super.getHeaderNames();
    while (clientNames != null && clientNames.hasMoreElements()) {
      String name = clientNames.nextElement();
      if (!suppressed.contains(name) && !headerMap.containsKey(name)) {
        names.add(name);
      }
    }
    names.addAll(headerMap.keySet());
    return Collections.enumeration(names);
  }

  @Override
  public Enumeration<String> getHeaders(String name) {
    // When the filter overrides a header (e.g. validated UserId/SessionId), the wrapper value is
    // authoritative and must shadow any client-supplied value. Returning the client value first
    // would let a caller reading element 0 (engine.io Polling -> WebSocketManager) impersonate
    // another user / bypass session revalidation. See
    // SocketAddressFilterSpoofRevalidationBypassTest.
    if (suppressed.contains(name)) {
      return Collections.emptyEnumeration();
    }
    if (headerMap.containsKey(name)) {
      return Collections.enumeration(List.of(headerMap.get(name)));
    }
    return super.getHeaders(name);
  }
}
