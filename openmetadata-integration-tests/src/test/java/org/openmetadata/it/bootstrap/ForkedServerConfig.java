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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.dropwizard.db.DataSourceFactory;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * The yaml of a forked server: the suite's own base yaml with every value the suite derives at run
 * time replaced by the value of the suite's live configuration object.
 *
 * <p>The signing key files, key id, issuer and Fernet key are copied from that object, the one the
 * suite's server was started with, and never read from the file a second time. A token the suite
 * server signs therefore verifies on the forked server, and a secret it encrypts decrypts there.
 * The database, search, cache and migration settings come from the same object, so both servers use
 * the suite's containers.
 */
final class ForkedServerConfig {
  private static final YAMLMapper YAML =
      YAMLMapper.builder().disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER).build();
  private static final ObjectMapper JSON = JsonUtils.getObjectMapper();
  private static final int POOL_MAX = 30;
  private static final int POOL_MIN = 5;

  private ForkedServerConfig() {}

  record Ports(int http, int admin) {}

  /**
   * @param baseYaml the yaml the suite's server reads
   * @param suite the suite server's configuration
   * @param credentialVerification per-node values for the {@code credentialVerification:} block,
   *     for example {@code sweepInterval -> 2500ms}
   */
  static String render(
      Path baseYaml,
      OpenMetadataApplicationConfig suite,
      Ports ports,
      Map<String, String> credentialVerification)
      throws IOException {
    ObjectNode root = (ObjectNode) YAML.readTree(baseYaml.toFile());
    setPorts(root, ports);
    setDatabase(root, suite);
    setSharedKeys(root, suite);
    setBackingServices(root, suite);
    ObjectNode verification = (ObjectNode) JSON.valueToTree(suite.getCredentialVerification());
    credentialVerification.forEach(verification::put);
    root.set("credentialVerification", verification);
    return YAML.writeValueAsString(root);
  }

  private static void setPorts(ObjectNode root, Ports ports) {
    connector(root, "applicationConnectors").put("port", ports.http());
    connector(root, "adminConnectors").put("port", ports.admin());
  }

  private static ObjectNode connector(ObjectNode root, String kind) {
    return (ObjectNode) ((ArrayNode) root.path("server").path(kind)).get(0);
  }

  private static void setDatabase(ObjectNode root, OpenMetadataApplicationConfig suite) {
    DataSourceFactory source = suite.getDataSourceFactory();
    ObjectNode database = (ObjectNode) root.path("database");
    database.put("driverClass", source.getDriverClass());
    database.put("url", source.getUrl());
    database.put("user", source.getUser());
    database.put("password", source.getPassword());
    database.put("maxSize", POOL_MAX);
    database.put("minSize", POOL_MIN);
    database.put("initialSize", POOL_MIN);
  }

  private static void setSharedKeys(ObjectNode root, OpenMetadataApplicationConfig suite) {
    ObjectNode jwt = (ObjectNode) root.path("jwtTokenConfiguration");
    var jwtConfig = suite.getJwtTokenConfiguration();
    jwt.put("rsapublicKeyFilePath", absolute(jwtConfig.getRsapublicKeyFilePath()));
    jwt.put("rsaprivateKeyFilePath", absolute(jwtConfig.getRsaprivateKeyFilePath()));
    jwt.put("jwtissuer", jwtConfig.getJwtissuer());
    jwt.put("keyId", jwtConfig.getKeyId());
    ((ObjectNode) root.path("fernetConfiguration"))
        .put("fernetKey", suite.getFernetConfiguration().getFernetKey());
  }

  private static void setBackingServices(ObjectNode root, OpenMetadataApplicationConfig suite) {
    root.set("elasticsearch", JSON.valueToTree(suite.getElasticSearchConfiguration()));
    root.set("cache", JSON.valueToTree(suite.getCacheConfig()));
    root.set("migrationConfiguration", JSON.valueToTree(suite.getMigrationConfiguration()));
    RdfConfiguration rdf = suite.getRdfConfiguration();
    if (rdf != null && Boolean.TRUE.equals(rdf.getEnabled())) {
      root.set("rdf", JSON.valueToTree(rdf));
    }
    JsonNode pipeline = JSON.valueToTree(suite.getPipelineServiceClientConfiguration());
    root.set("pipelineServiceClientConfiguration", pipeline);
  }

  private static String absolute(String path) {
    return Path.of(path).toAbsolutePath().toString();
  }
}
