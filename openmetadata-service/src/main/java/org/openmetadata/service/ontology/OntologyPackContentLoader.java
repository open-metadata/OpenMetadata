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

package org.openmetadata.service.ontology;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

public final class OntologyPackContentLoader {
  private static final String SHA_256 = "SHA-256";
  private final ClassLoader classLoader;

  public OntologyPackContentLoader(final ClassLoader classLoader) {
    this.classLoader = Objects.requireNonNull(classLoader);
  }

  public PackContent load(final String resourcePath) {
    final byte[] bytes = read(resourcePath);
    return new PackContent(new String(bytes, StandardCharsets.UTF_8), sha256(bytes));
  }

  private byte[] read(final String resourcePath) {
    try (InputStream input = requireResource(resourcePath)) {
      return input.readAllBytes();
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to read ontology pack resource '%s'".formatted(resourcePath), exception);
    }
  }

  private InputStream requireResource(final String resourcePath) {
    final InputStream input = classLoader.getResourceAsStream(Objects.requireNonNull(resourcePath));
    if (input == null) {
      throw new IllegalStateException(
          "Required ontology pack resource is missing: " + resourcePath);
    }
    return input;
  }

  private static String sha256(final byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance(SHA_256).digest(bytes));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("JVM does not provide SHA-256", exception);
    }
  }

  public record PackContent(String body, String sha256) {}
}
