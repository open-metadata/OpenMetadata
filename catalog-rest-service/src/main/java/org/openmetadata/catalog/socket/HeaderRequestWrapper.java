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

package org.openmetadata.catalog.socket;

import java.util.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;

public class HeaderRequestWrapper extends HttpServletRequestWrapper {

  public HeaderRequestWrapper(HttpServletRequest request) {
    super(request);
  }

  private Map<String, String> headerMap = new HashMap<>();

  public void addHeader(String name, String value) {
    headerMap.put(name, value);
  }

  @Override
  public String getHeader(String name) {
    String headerValue = super.getHeader(name);
    if (headerMap.containsKey(name)) {
      headerValue = headerMap.get(name);
    }
    return headerValue;
  }

  @Override
  public Enumeration<String> getHeaderNames() {
    List<String> names = Collections.list(super.getHeaderNames());
    names.addAll(headerMap.keySet());
    return Collections.enumeration(names);
  }

  @Override
  public Enumeration<String> getHeaders(String name) {
    List<String> values = Collections.list(super.getHeaders(name));
    if (headerMap.containsKey(name)) {
      values.add(headerMap.get(name));
    }
    return Collections.enumeration(values);
  }
}
