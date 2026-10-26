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
package org.openmetadata.it.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.util.Duration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.bootstrap.ForkedServerConfig.Ports;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

/**
 * The yaml of a forked server must load back through the same Dropwizard factory the application
 * uses, and carry the suite's shared values, not the base file's.
 */
class ForkedServerConfigTest {
  private static final String BASE =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  private static final Ports PORTS = new Ports(41001, 41002);

  private static OpenMetadataApplicationConfig suite;

  @BeforeAll
  static void readSuiteConfig() throws Exception {
    suite = load(Path.of(BASE));
    HikariCPDataSourceFactory pool = new HikariCPDataSourceFactory();
    pool.setUrl("jdbc:mysql://db-host:3307/openmetadata_it");
    pool.setUser("suite-user");
    pool.setPassword("suite-secret");
    pool.setDriverClass("com.mysql.cj.jdbc.Driver");
    suite.setDataSourceFactory(pool);
    suite.setElasticSearchConfiguration(
        new ElasticSearchConfiguration().withHost("search-host").withPort(9201));
    suite.getJwtTokenConfiguration().setKeyId("suite-key-id");
    suite.getFernetConfiguration().setFernetKey("suiteFernetKeyForTheForkedNode0123");
    suite.getCacheConfig().provider = org.openmetadata.service.cache.CacheConfig.Provider.redis;
    suite.getCacheConfig().redis.url = "redis://redis-host:6380";
    suite.getCacheConfig().redis.keyspace = "om:it:42";
  }

  @Test
  void carriesTheSuitesSharedValuesAndThePortsOfTheNode(@TempDir Path dir) throws Exception {
    OpenMetadataApplicationConfig forked = render(dir, Map.of());

    assertEquals("suite-key-id", forked.getJwtTokenConfiguration().getKeyId());
    assertEquals("open-metadata.org", forked.getJwtTokenConfiguration().getJwtissuer());
    assertTrue(Path.of(forked.getJwtTokenConfiguration().getRsaprivateKeyFilePath()).isAbsolute());
    assertEquals(
        "suiteFernetKeyForTheForkedNode0123", forked.getFernetConfiguration().getFernetKey());
    assertEquals(
        "jdbc:mysql://db-host:3307/openmetadata_it", forked.getDataSourceFactory().getUrl());
    assertEquals("suite-secret", forked.getDataSourceFactory().getPassword());
    assertEquals("search-host", forked.getElasticSearchConfiguration().getHost());
    assertEquals(9201, forked.getElasticSearchConfiguration().getPort());
    assertEquals("redis://redis-host:6380", forked.getCacheConfig().redis.url);
    assertEquals("om:it:42", forked.getCacheConfig().redis.keyspace);
    DefaultServerFactory server = (DefaultServerFactory) forked.getServerFactory();
    assertEquals(
        41001, ((HttpConnectorFactory) server.getApplicationConnectors().get(0)).getPort());
    assertEquals(41002, ((HttpConnectorFactory) server.getAdminConnectors().get(0)).getPort());
  }

  @Test
  void appliesThePerNodeCredentialVerificationOverridesOverTheSuitesValues(@TempDir Path dir)
      throws Exception {
    OpenMetadataApplicationConfig forked = render(dir, Map.of("sweepInterval", "2500ms"));

    assertEquals(Duration.milliseconds(2500), forked.getCredentialVerification().sweepInterval());
    assertEquals(Duration.seconds(5), forked.getCredentialVerification().maxStaleness());
  }

  private static OpenMetadataApplicationConfig render(Path dir, Map<String, String> overrides)
      throws Exception {
    String yaml = ForkedServerConfig.render(Path.of(BASE), suite, PORTS, overrides);
    return load(Files.writeString(dir.resolve("forked.yaml"), yaml));
  }

  private static OpenMetadataApplicationConfig load(Path yaml) throws Exception {
    ObjectMapper mapper = Jackson.newObjectMapper();
    mapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, Validators.newValidator(), mapper, "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
        yaml.toString());
  }
}
