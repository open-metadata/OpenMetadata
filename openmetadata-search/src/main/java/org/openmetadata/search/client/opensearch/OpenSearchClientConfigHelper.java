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

package org.openmetadata.search.client.opensearch;

import java.io.FileInputStream;
import java.io.IOException;
import java.security.KeyManagementException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;

@UtilityClass
@Slf4j
public class OpenSearchClientConfigHelper {

  public static SSLContext createSSLContext(
      OpenSearchClientConfig.TrustStoreConfig trustStoreConfig) {
    try {
      KeyStore trustStore =
          KeyStore.getInstance(
              trustStoreConfig.getTrustStoreType() != null
                  ? trustStoreConfig.getTrustStoreType()
                  : KeyStore.getDefaultType());

      try (FileInputStream trustStoreStream =
          new FileInputStream(trustStoreConfig.getTrustStorePath())) {
        trustStore.load(trustStoreStream, trustStoreConfig.getTrustStorePassword().toCharArray());
      }

      TrustManagerFactory trustManagerFactory =
          TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
      trustManagerFactory.init(trustStore);

      SSLContext sslContext = SSLContext.getInstance("TLS");
      sslContext.init(null, trustManagerFactory.getTrustManagers(), null);

      return sslContext;

    } catch (KeyStoreException
        | IOException
        | NoSuchAlgorithmException
        | CertificateException
        | KeyManagementException e) {
      log.error("Failed to create SSL context", e);
      throw new RuntimeException("Failed to create SSL context", e);
    }
  }
}
