/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.security.auth.validator.protocol.mock;

import java.io.IOException;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.util.function.Function;

public class Handler extends URLStreamHandler {
  private static volatile Function<URL, URLConnection> connectionFactory;

  public static void setConnectionFactory(Function<URL, URLConnection> factory) {
    connectionFactory = factory;
  }

  public static void clearConnectionFactory() {
    connectionFactory = null;
  }

  @Override
  protected URLConnection openConnection(URL url) throws IOException {
    Function<URL, URLConnection> factory = connectionFactory;
    if (factory == null) {
      throw new IOException("No mock URL connection factory configured");
    }
    return factory.apply(url);
  }
}
