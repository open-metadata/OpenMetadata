package org.openmetadata.catalog.util;

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
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.ssl.SSLContextBuilder;
import org.apache.http.ssl.SSLContexts;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.catalog.ElasticSearchConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class ElasticSearchClientUtils {
  private static final Logger LOG = LoggerFactory.getLogger(ElasticSearchClientUtils.class);

  private ElasticSearchClientUtils() {}

  public static RestHighLevelClient createElasticSearchClient(ElasticSearchConfiguration esConfig) {
    try {
      RestClientBuilder restClientBuilder =
          RestClient.builder(new HttpHost(esConfig.getHost(), esConfig.getPort(), esConfig.getScheme()));

      if (StringUtils.isNotEmpty(esConfig.getUsername()) && StringUtils.isNotEmpty(esConfig.getUsername())) {
        CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
        credentialsProvider.setCredentials(
            AuthScope.ANY, new UsernamePasswordCredentials(esConfig.getUsername(), esConfig.getPassword()));
        SSLContext sslContext = createSSLContext(esConfig);
        restClientBuilder.setHttpClientConfigCallback(
            httpAsyncClientBuilder -> {
              httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
              // httpAsyncClientBuilder.setSSLHostnameVerifier((s, sslSession) -> true);
              if (sslContext != null) {
                httpAsyncClientBuilder.setSSLContext(sslContext);
              }
              return httpAsyncClientBuilder;
            });
      }
      restClientBuilder.setRequestConfigCallback(
          requestConfigBuilder ->
              requestConfigBuilder
                  .setConnectTimeout(esConfig.getConnectionTimeoutSecs() * 1000)
                  .setSocketTimeout(esConfig.getSocketTimeoutSecs() * 1000));
      return new RestHighLevelClient(restClientBuilder);
    } catch (Exception e) {
      throw new RuntimeException("Failed to create elastic search client ", e);
    }
  }

  private static SSLContext createSSLContext(ElasticSearchConfiguration elasticSearchConfiguration)
      throws KeyStoreException {

    if (elasticSearchConfiguration.getScheme().equals("https")) {
      if (elasticSearchConfiguration.getTruststorePath() != null) {
        Path trustStorePath = Paths.get(elasticSearchConfiguration.getTruststorePath());
        KeyStore truststore = KeyStore.getInstance("jks");
        try (InputStream is = Files.newInputStream(trustStorePath)) {
          truststore.load(is, elasticSearchConfiguration.getTruststorePassword().toCharArray());
          SSLContextBuilder sslBuilder = SSLContexts.custom().loadTrustMaterial(truststore, null);
          return sslBuilder.build();
        } catch (IOException
            | NoSuchAlgorithmException
            | CertificateException
            | KeyStoreException
            | KeyManagementException e) {
          throw new RuntimeException("Failed to crete SSLContext to for ElasticSearch Client", e);
        }
      }
    }
    return null;
  }
}
