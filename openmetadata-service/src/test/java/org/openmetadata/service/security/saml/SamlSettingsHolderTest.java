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

package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.KeyStore;
import org.junit.jupiter.api.Test;

class SamlSettingsHolderTest {
  private static final char[] KEYSTORE_PASSWORD = "changeit".toCharArray();

  @Test
  void loadKeyStoreClosesInputStream() throws Exception {
    TrackingInputStream inputStream = new TrackingInputStream(createKeyStoreBytes());

    KeyStore keyStore = SamlSettingsHolder.loadKeyStore(inputStream, KEYSTORE_PASSWORD);

    assertNotNull(keyStore);
    assertTrue(inputStream.isClosed());
  }

  private byte[] createKeyStoreBytes() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, KEYSTORE_PASSWORD);
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    keyStore.store(outputStream, KEYSTORE_PASSWORD);
    return outputStream.toByteArray();
  }

  private static final class TrackingInputStream extends ByteArrayInputStream {
    private boolean closed;

    private TrackingInputStream(byte[] data) {
      super(data);
    }

    @Override
    public void close() throws IOException {
      closed = true;
      super.close();
    }

    private boolean isClosed() {
      return closed;
    }
  }
}
