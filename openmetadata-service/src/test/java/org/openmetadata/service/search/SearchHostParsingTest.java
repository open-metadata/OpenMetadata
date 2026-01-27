package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import org.apache.http.HttpHost;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

class SearchHostParsingTest {

  @Test
  void testSingleHostWithoutPort() {
    ElasticSearchConfiguration config = createConfig("localhost", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals("localhost", hosts[0].getHostName());
    assertEquals(9200, hosts[0].getPort());
    assertEquals("http", hosts[0].getSchemeName());
  }

  @Test
  void testSingleHostWithPort() {
    ElasticSearchConfiguration config = createConfig("localhost:9201", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals("localhost", hosts[0].getHostName());
    assertEquals(9201, hosts[0].getPort());
  }

  @Test
  void testMultipleHostsCommaSeparated() {
    ElasticSearchConfiguration config =
        createConfig("es-node1:9200,es-node2:9200,es-node3:9200", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    assertEquals("es-node1", hosts[0].getHostName());
    assertEquals(9200, hosts[0].getPort());
    assertEquals("es-node2", hosts[1].getHostName());
    assertEquals(9200, hosts[1].getPort());
    assertEquals("es-node3", hosts[2].getHostName());
    assertEquals(9200, hosts[2].getPort());
  }

  @Test
  void testMultipleHostsWithDifferentPorts() {
    ElasticSearchConfiguration config =
        createConfig("es-node1:9200,es-node2:9201,es-node3:9202", 9200, "https");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    assertEquals(9200, hosts[0].getPort());
    assertEquals(9201, hosts[1].getPort());
    assertEquals(9202, hosts[2].getPort());
    for (HttpHost host : hosts) {
      assertEquals("https", host.getSchemeName());
    }
  }

  @Test
  void testMultipleHostsWithoutPorts() {
    ElasticSearchConfiguration config = createConfig("es-node1,es-node2,es-node3", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    for (HttpHost host : hosts) {
      assertEquals(9200, host.getPort());
    }
  }

  @Test
  void testMultipleHostsMixedPortFormats() {
    ElasticSearchConfiguration config =
        createConfig("es-node1:9201,es-node2,es-node3:9203", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    assertEquals(9201, hosts[0].getPort());
    assertEquals(9200, hosts[1].getPort());
    assertEquals(9203, hosts[2].getPort());
  }

  @Test
  void testHostsWithSpaces() {
    ElasticSearchConfiguration config =
        createConfig("es-node1:9200, es-node2:9200 , es-node3:9200", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    assertEquals("es-node1", hosts[0].getHostName());
    assertEquals("es-node2", hosts[1].getHostName());
    assertEquals("es-node3", hosts[2].getHostName());
  }

  @Test
  void testAwsOpenSearchHost() {
    ElasticSearchConfiguration config =
        createConfig("vpc-my-domain-abc123.us-east-1.es.amazonaws.com:443", null, "https");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals("vpc-my-domain-abc123.us-east-1.es.amazonaws.com", hosts[0].getHostName());
    assertEquals(443, hosts[0].getPort());
    assertEquals("https", hosts[0].getSchemeName());
  }

  @Test
  void testAwsOpenSearchServerlessHost() {
    ElasticSearchConfiguration config =
        createConfig("abc123xyz.us-east-1.aoss.amazonaws.com", 443, "https");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals("abc123xyz.us-east-1.aoss.amazonaws.com", hosts[0].getHostName());
    assertEquals(443, hosts[0].getPort());
  }

  @ParameterizedTest
  @NullAndEmptySource
  void testEmptyOrNullHostThrowsException(String host) {
    ElasticSearchConfiguration config = createConfig(host, 9200, "http");

    assertThrows(IllegalArgumentException.class, () -> buildHttpHosts(config));
  }

  @ParameterizedTest
  @CsvSource({
    "localhost,9200,http,localhost,9200,http",
    "127.0.0.1,9200,http,127.0.0.1,9200,http",
    "es.example.com:443,9200,https,es.example.com,443,https",
    "192.168.1.100:9201,9200,http,192.168.1.100,9201,http"
  })
  void testVariousHostFormats(
      String inputHost,
      int defaultPort,
      String scheme,
      String expectedHost,
      int expectedPort,
      String expectedScheme) {
    ElasticSearchConfiguration config = createConfig(inputHost, defaultPort, scheme);
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals(expectedHost, hosts[0].getHostName());
    assertEquals(expectedPort, hosts[0].getPort());
    assertEquals(expectedScheme, hosts[0].getSchemeName());
  }

  @Test
  void testDefaultPortWhenNotSpecified() {
    ElasticSearchConfiguration config = createConfig("localhost", null, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals(9200, hosts[0].getPort());
  }

  @Test
  void testIpv4Address() {
    ElasticSearchConfiguration config = createConfig("192.168.1.100:9200", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(1, hosts.length);
    assertEquals("192.168.1.100", hosts[0].getHostName());
  }

  @Test
  void testMultipleIpAddresses() {
    ElasticSearchConfiguration config =
        createConfig("192.168.1.100:9200,192.168.1.101:9200,192.168.1.102:9200", 9200, "http");
    HttpHost[] hosts = buildHttpHosts(config);

    assertEquals(3, hosts.length);
    assertEquals("192.168.1.100", hosts[0].getHostName());
    assertEquals("192.168.1.101", hosts[1].getHostName());
    assertEquals("192.168.1.102", hosts[2].getHostName());
  }

  @Test
  void testInvalidPortFormatThrowsException() {
    ElasticSearchConfiguration config = createConfig("localhost:abc", 9200, "http");

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> buildHttpHosts(config));
    assertTrue(exception.getMessage().contains("Invalid port"));
    assertTrue(exception.getMessage().contains("abc"));
  }

  @Test
  void testInvalidPortInMultipleHostsThrowsException() {
    ElasticSearchConfiguration config =
        createConfig("es-node1:9200,es-node2:invalid,es-node3:9200", 9200, "http");

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> buildHttpHosts(config));
    assertTrue(exception.getMessage().contains("Invalid port"));
    assertTrue(exception.getMessage().contains("invalid"));
  }

  private ElasticSearchConfiguration createConfig(String host, Integer port, String scheme) {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost(host);
    config.setPort(port);
    config.setScheme(scheme);
    return config;
  }

  private HttpHost[] buildHttpHosts(ElasticSearchConfiguration esConfig) {
    return SearchUtils.buildHttpHosts(esConfig, "Test");
  }
}
