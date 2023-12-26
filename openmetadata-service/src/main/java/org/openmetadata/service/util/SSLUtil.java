package org.openmetadata.service.util;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyManagementException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import javax.net.ssl.SSLContext;
import org.apache.http.ssl.SSLContextBuilder;
import org.apache.http.ssl.SSLContexts;
import org.openmetadata.service.exception.UnhandledServerException;

public class SSLUtil {
  private SSLUtil() {
    /* Hidden constructor */
  }

  public static SSLContext createSSLContext(
      String truststorePath, String trustStorePassword, String client) throws KeyStoreException {

    if (truststorePath != null
        && !truststorePath.isEmpty()
        && trustStorePassword != null
        && !trustStorePassword.isEmpty()) {
      Path trustStorePath = Paths.get(truststorePath);
      KeyStore truststore = KeyStore.getInstance("jks");
      try (InputStream is = Files.newInputStream(trustStorePath)) {
        truststore.load(is, trustStorePassword.toCharArray());
        SSLContextBuilder sslBuilder = SSLContexts.custom().loadTrustMaterial(truststore, null);
        return sslBuilder.build();
      } catch (IOException
          | NoSuchAlgorithmException
          | CertificateException
          | KeyStoreException
          | KeyManagementException e) {
        throw new UnhandledServerException(
            String.format("Failed to create SSLContext for [%s]", client), e);
      }
    }
    return null;
  }
}
