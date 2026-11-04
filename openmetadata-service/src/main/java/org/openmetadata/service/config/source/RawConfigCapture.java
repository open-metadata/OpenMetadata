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

package org.openmetadata.service.config.source;

import io.dropwizard.configuration.ConfigurationSourceProvider;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Keeps a copy of a configuration file as written, before environment substitution, so the server
 * can tell which environment variable sets each field and what its default is. Wrap the provider
 * that reads the file, underneath the substituting provider.
 */
public final class RawConfigCapture implements ConfigurationSourceProvider {
  private final ConfigurationSourceProvider delegate;
  private final ConfigTemplateKind kind;

  public RawConfigCapture(ConfigurationSourceProvider delegate, ConfigTemplateKind kind) {
    this.delegate = delegate;
    this.kind = kind;
  }

  @Override
  public InputStream open(String path) throws IOException {
    try (InputStream source = delegate.open(path)) {
      byte[] content = source.readAllBytes();
      ConfigTemplates.record(kind, new String(content, StandardCharsets.UTF_8));
      return new ByteArrayInputStream(content);
    }
  }
}
