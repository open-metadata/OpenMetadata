package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.utils.SupersetApiConnection;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpHeaders;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dasboard.powerbi.GCSConfig;
import org.openmetadata.schema.services.connections.dashboard.DomoDashboardConnection;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.PowerBIConnection;
import org.openmetadata.schema.services.connections.dashboard.QlikSenseConnection;
import org.openmetadata.schema.services.connections.dashboard.SapS4HanaConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.qlikSense.QlikCertificateValues;
import org.openmetadata.schema.services.connections.dashboard.sapS4Hana.SapS4HanaOAuthCredentials;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.MicrosoftFabricConnection;
import org.openmetadata.schema.services.connections.database.MssqlConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig__1;
import org.openmetadata.schema.services.connections.database.common.GcpCloudSqlConfig;
import org.openmetadata.schema.services.connections.database.microsoftFabric.CertificateAuthentication;
import org.openmetadata.schema.services.connections.database.microsoftFabric.ClientSecretAuthentication;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.drive.sftp.SftpKeyAuth;
import org.openmetadata.schema.services.connections.llm.CustomLLMConnection;
import org.openmetadata.schema.services.connections.llm.Headers;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.services.connections.messaging.ConsumerConfig;
import org.openmetadata.schema.services.connections.messaging.ConsumerConfig__1;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.RedpandaConnection;
import org.openmetadata.schema.services.connections.messaging.SchemaRegistryConfig;
import org.openmetadata.schema.services.connections.messaging.nats.NatsTokenAuth;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.service.exception.EntityMaskException;

public class PasswordEntityMaskerTest extends TestEntityMasker {
  private static final String CUSTOM_SECRET_KEY = "custom.plugin.secret";
  private static final String CUSTOM_SECRET = "plugin-secret";
  private static final String TOKEN = "openmetadata-token";
  private static final String ALPHA_KEY = "alpha-api-key";
  private static final String GAMMA_KEY = "gamma-key";
  private static final String BETA_KEY = "beta-api-key";
  private static final String SFTP_PASSWORD = "openmetadata-sftp-secret";
  private static final String NESTED_SECRET = "openmetadata-nested-secret";
  private static final String GCP_PRIVATE_KEY = "openmetadata-gcp-private-key";
  private static final String FABRIC_CERTIFICATE = "fabric-certificate-pem";
  private static final String FABRIC_PRIVATE_KEY = "fabric-private-key-pem";
  private static final String FABRIC_PASSPHRASE = "fabric-key-passphrase";
  private static final String OAUTH_CLIENT_SECRET = "oauth-client-secret";
  private static final String REGISTRY_USER_INFO = "registry:registry-password";
  private static final String KEY_PASSPHRASE = "client-key-passphrase";
  private static final String GITLAB_TOKEN = "gitlab-private-token";
  private static final String LLM_HEADER_TOKEN = "Bearer llm-token";

  public PasswordEntityMaskerTest() {
    CONFIG.setMaskPasswordsAPI(true);
  }

  @Override
  protected String getMaskedPassword() {
    return PasswordEntityMasker.PASSWORD_MASK;
  }

  @Test
  void testOpenMetadataServerJwtTokenIsMaskedAndRestored() {
    // OpenMetadataJWTClientConfig#jwtToken (the token embedded in a server connection) is a
    // @PasswordField: it must be masked for non-bot readers and restored on write.
    final OpenMetadataConnection original =
        new OpenMetadataConnection()
            .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken(TOKEN));

    final OpenMetadataConnection masked =
        (OpenMetadataConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "OpenMetadata", ServiceType.METADATA);
    assertEquals(getMaskedPassword(), masked.getSecurityConfig().getJwtToken());

    final OpenMetadataConnection restored =
        (OpenMetadataConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(
                    masked, original, "OpenMetadata", ServiceType.METADATA);
    assertEquals(TOKEN, restored.getSecurityConfig().getJwtToken());
  }

  @Test
  void testDomoDeveloperTokenIsMaskedAndRestored() {
    DomoDashboardConnection original = new DomoDashboardConnection().withAccessToken(TOKEN);

    DomoDashboardConnection masked =
        (DomoDashboardConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "DomoDashboard", ServiceType.DASHBOARD);
    assertEquals(getMaskedPassword(), masked.getAccessToken());

    DomoDashboardConnection restored =
        (DomoDashboardConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(
                    masked, original, "DomoDashboard", ServiceType.DASHBOARD);
    assertEquals(TOKEN, restored.getAccessToken());
  }

  @Test
  void testLookerDisplayUrlIsAcceptedWhenRestoringSecrets() {
    Map<String, Object> updated =
        Map.of(
            "type", "Looker",
            "clientId", "test-client",
            "clientSecret", getMaskedPassword(),
            "hostPort", "https://api.example.com",
            "displayUrl", "https://ui.example.com");
    LookerConnection original =
        new LookerConnection()
            .withClientId("test-client")
            .withClientSecret(TOKEN)
            .withHostPort(URI.create("https://api.example.com"));

    LookerConnection restored =
        (LookerConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(updated, original, "Looker", ServiceType.DASHBOARD);

    assertEquals(URI.create("https://ui.example.com"), restored.getDisplayUrl());
    assertEquals(TOKEN, restored.getClientSecret());
  }

  @Test
  void testAstraTokenIsMaskedAndRestored() {
    CloudConfig cloudConfig =
        new CloudConfig().withCloudConfig(new CloudConfig__1().withToken(TOKEN));
    CassandraConnection original = new CassandraConnection().withAuthType(cloudConfig);

    CassandraConnection masked =
        (CassandraConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Cassandra", ServiceType.DATABASE);
    assertEquals(getMaskedPassword(), astraToken(masked));

    CassandraConnection restored =
        (CassandraConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Cassandra", ServiceType.DATABASE);
    assertEquals(TOKEN, astraToken(restored));
  }

  private String astraToken(CassandraConnection connection) {
    return ((CloudConfig) connection.getAuthType()).getCloudConfig().getToken();
  }

  /**
   * Secrets inside a collection are restored by element identity, not by position. Keying on
   * position means deleting the first of two servers shifts the second into slot 0, so it would be
   * handed the deleted server's key while its own is lost.
   */
  @Test
  void testCollectionSecretsFollowTheElementNotThePosition() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("beta").withApiKey(BETA_KEY)));
    // What the edit form sends back after deleting "alpha": "beta" alone, key still masked.
    McpConnection edited =
        new McpConnection()
            .withServers(
                List.of(new McpServerConfig().withName("beta").withApiKey(getMaskedPassword())));

    final McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(edited, original, "Mcp", ServiceType.MCP);

    assertEquals(1, restored.getServers().size());
    assertEquals(BETA_KEY, restored.getServers().getFirst().getApiKey());
  }

  /** Reordering must not swap the two servers' keys either. */
  @Test
  void testCollectionSecretsSurviveReordering() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("beta").withApiKey(BETA_KEY)));
    McpConnection reordered =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("beta").withApiKey(getMaskedPassword()),
                    new McpServerConfig().withName("alpha").withApiKey(getMaskedPassword())));

    final McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(reordered, original, "Mcp", ServiceType.MCP);

    assertEquals(BETA_KEY, restored.getServers().getFirst().getApiKey());
    assertEquals(ALPHA_KEY, restored.getServers().get(1).getApiKey());
  }

  /**
   * A name is only an identity if it is unique, and the schema does not enforce that. Two servers
   * sharing a name must not share a key, or one secret would overwrite the other and both entries
   * would come back holding the survivor.
   */
  @Test
  void testDuplicateNamesDoNotShareASecret() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("dup").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("dup").withApiKey(BETA_KEY)));
    McpConnection edited =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("dup").withApiKey(getMaskedPassword()),
                    new McpServerConfig().withName("dup").withApiKey(getMaskedPassword())));

    final McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(edited, original, "Mcp", ServiceType.MCP);

    assertEquals(ALPHA_KEY, restored.getServers().getFirst().getApiKey());
    assertEquals(BETA_KEY, restored.getServers().get(1).getApiKey());
  }

  /**
   * Names that share one secret id once cleaned (case, punctuation) are still distinct servers: a
   * masked key follows its own server through a reorder.
   */
  @Test
  void testNamesSharingASecretIdKeepTheirOwnKeysWhenReordered() {
    final McpConnection restored =
        unmaskServers(
            List.of(server("Prod", ALPHA_KEY), server("prod", BETA_KEY)),
            List.of(server("prod", getMaskedPassword()), server("Prod", getMaskedPassword())));

    assertEquals(BETA_KEY, restored.getServers().getFirst().getApiKey());
    assertEquals(ALPHA_KEY, restored.getServers().get(1).getApiKey());
  }

  /** Deleting server "1" must not hand its key to server "2", which then sits in slot 0. */
  @Test
  void testDigitOnlyNamesKeepTheirOwnKeysWhenOneIsDeleted() {
    final McpConnection restored =
        unmaskServers(
            List.of(server("1", ALPHA_KEY), server("2", BETA_KEY)),
            List.of(server("2", getMaskedPassword())));

    assertEquals(BETA_KEY, restored.getServers().getFirst().getApiKey());
  }

  /** A server named like a position key must not take the key of the server in that position. */
  @Test
  void testANameLikeAPositionKeyKeepsItsOwnKey() {
    final McpConnection restored =
        unmaskServers(
            List.of(server("#1", ALPHA_KEY), server("dup", BETA_KEY), server("dup", GAMMA_KEY)),
            List.of(
                server("#1", getMaskedPassword()),
                server("dup", getMaskedPassword()),
                server("dup", getMaskedPassword())));

    assertEquals(ALPHA_KEY, restored.getServers().getFirst().getApiKey());
    assertEquals(BETA_KEY, restored.getServers().get(1).getApiKey());
    assertEquals(GAMMA_KEY, restored.getServers().get(2).getApiKey());
  }

  private static McpServerConfig server(String name, String apiKey) {
    return new McpServerConfig().withName(name).withApiKey(apiKey);
  }

  private static McpConnection unmaskServers(
      List<McpServerConfig> original, List<McpServerConfig> edited) {
    return (McpConnection)
        EntityMaskerFactory.createEntityMasker()
            .unmaskServiceConnectionConfig(
                new McpConnection().withServers(edited),
                new McpConnection().withServers(original),
                "Mcp",
                ServiceType.MCP);
  }

  /**
   * A masked value means "keep the stored secret". Renaming a server while sending its key back
   * masked leaves nothing stored under the new name, so it must be refused rather than storing the
   * mask as the key.
   */
  @Test
  void testMaskedSecretWithNoStoredValueIsRejected() {
    McpConnection original =
        new McpConnection()
            .withServers(List.of(new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY)));
    McpConnection renamed =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig()
                        .withName("alpha-renamed")
                        .withApiKey(getMaskedPassword())));

    EntityMaskException thrown =
        Assertions.assertThrows(
            EntityMaskException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .unmaskServiceConnectionConfig(renamed, original, "Mcp", ServiceType.MCP));

    assertEquals(400, thrown.getResponse().getStatus());
  }

  @Test
  void testSftpPasswordIsMaskedAndRestored() {
    SftpConnection original =
        new SftpConnection()
            .withHost("sftp.example.com")
            .withAuthType(
                new SftpBasicAuth().withUsername("sftp-user").withPassword(SFTP_PASSWORD));

    SftpConnection masked =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Sftp", ServiceType.DRIVE);
    assertEquals(getMaskedPassword(), sftpPassword(masked));
    assertEquals("sftp-user", sftpAuth(masked).getUsername());

    SftpConnection restored =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Sftp", ServiceType.DRIVE);
    assertEquals(SFTP_PASSWORD, sftpPassword(restored));
  }

  /** The config arrives from the database as a map, which is what used to defeat the masker. */
  @Test
  void testSftpPrivateKeyFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "host",
            "sftp.example.com",
            "authType",
            Map.of("username", "sftp-user", "privateKey", SFTP_PASSWORD));

    SftpConnection masked =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(serialized, "Sftp", ServiceType.DRIVE);

    assertEquals(getMaskedPassword(), ((SftpKeyAuth) masked.getAuthType()).getPrivateKey());
  }

  @Test
  void testPowerBiGcsPrivateKeyFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "PowerBI",
            "clientId",
            "client-id",
            "clientSecret",
            "client-secret",
            "tenantId",
            "tenant-id",
            "pbitFilesSource",
            Map.of(
                "pbitFileConfigType",
                "gcs",
                "securityConfig",
                Map.of("gcpConfig", gcpServiceAccount()),
                "prefixConfig",
                Map.of("bucketName", "bucket")));

    PowerBIConnection masked =
        (PowerBIConnection) mask(serialized, "PowerBI", ServiceType.DASHBOARD);

    GCSConfig gcs = (GCSConfig) masked.getPbitFilesSource();
    assertEquals(getMaskedPassword(), gcpValues(gcs.getSecurityConfig()).getPrivateKey());
  }

  @Test
  void testSupersetApiSslConfigFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "Superset",
            "hostPort",
            "http://superset:8088",
            "connection",
            Map.of(
                "provider",
                "db",
                "username",
                "admin",
                "password",
                "admin-password",
                "verifySSL",
                "validate",
                "sslConfig",
                Map.of("caCertificate", NESTED_SECRET)));

    SupersetConnection masked =
        (SupersetConnection) mask(serialized, "Superset", ServiceType.DASHBOARD);

    SupersetApiConnection api = (SupersetApiConnection) masked.getConnection();
    assertEquals(
        getMaskedPassword(), ((ValidateSSLClientConfig) api.getSslConfig()).getCaCertificate());
  }

  @Test
  void testMysqlCloudSqlAuthFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "Mysql",
            "hostPort",
            "mysql:3306",
            "username",
            "openmetadata",
            "authType",
            Map.of(
                "password",
                NESTED_SECRET,
                "enableIamAuth",
                false,
                "gcpConfig",
                Map.of("gcpConfig", gcpServiceAccount())));

    MysqlConnection masked = (MysqlConnection) mask(serialized, "Mysql", ServiceType.DATABASE);

    GcpCloudSqlConfig cloudSql = (GcpCloudSqlConfig) masked.getAuthType();
    assertEquals(getMaskedPassword(), cloudSql.getPassword());
    assertEquals(getMaskedPassword(), gcpValues(cloudSql.getGcpConfig()).getPrivateKey());
  }

  /** Masks a config shaped as it is stored: nested auth objects arrive as plain maps. */
  @Test
  void testSsisDatabaseConnectionSslConfigFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "SSIS",
            "packageConnection",
            "/opt/ssis/projects",
            "databaseConnection",
            Map.of(
                "type",
                "Mssql",
                "hostPort",
                "mssql:1433",
                "username",
                "sa",
                "sslConfig",
                Map.of("caCertificate", NESTED_SECRET)));

    final SSISConnection masked = (SSISConnection) mask(serialized, "SSIS", ServiceType.PIPELINE);

    final MssqlConnection database = masked.getDatabaseConnection();
    assertEquals(
        getMaskedPassword(),
        ((ValidateSSLClientConfig) database.getSslConfig()).getCaCertificate());
  }

  @Test
  void testQlikSenseCertificateValuesFromSerializedConfigAreMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "QlikSense",
            "hostPort",
            "https://qlik:4242",
            "certificates",
            Map.of("sslConfig", Map.of("caCertificate", NESTED_SECRET, "sslKey", NESTED_SECRET)));

    final QlikSenseConnection masked =
        (QlikSenseConnection) mask(serialized, "QlikSense", ServiceType.DASHBOARD);

    final ValidateSSLClientConfig ssl =
        (ValidateSSLClientConfig) ((QlikCertificateValues) masked.getCertificates()).getSslConfig();
    assertEquals(getMaskedPassword(), ssl.getCaCertificate());
    assertEquals(getMaskedPassword(), ssl.getSslKey());
  }

  @Test
  void testSapS4HanaOAuthClientSecretFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of(
            "type",
            "SapS4Hana",
            "hostPort",
            "https://sap.example.com",
            "authType",
            Map.of(
                "authType",
                "oauth2",
                "clientId",
                "client",
                "clientSecret",
                NESTED_SECRET,
                "tokenEndpoint",
                "https://sap.example.com/token"));

    final SapS4HanaConnection masked =
        (SapS4HanaConnection) mask(serialized, "SapS4Hana", ServiceType.DASHBOARD);

    assertEquals(
        getMaskedPassword(), ((SapS4HanaOAuthCredentials) masked.getAuthType()).getClientSecret());
  }

  @Test
  void testNatsTokenAuthFromSerializedConfigIsMasked() {
    final Map<String, Object> serialized =
        Map.of("type", "Nats", "authType", Map.of("token", NESTED_SECRET));

    final NatsConnection masked = (NatsConnection) mask(serialized, "Nats", ServiceType.MESSAGING);

    assertEquals(getMaskedPassword(), ((NatsTokenAuth) masked.getAuthType()).getToken());
  }

  private Object mask(
      Map<String, Object> serialized, String connectionType, ServiceType serviceType) {
    return EntityMaskerFactory.createEntityMasker()
        .maskServiceConnectionConfig(serialized, connectionType, serviceType);
  }

  private static GCPValues gcpValues(GCPCredentials credentials) {
    return (GCPValues) credentials.getGcpConfig();
  }

  private static Map<String, Object> gcpServiceAccount() {
    return Map.of(
        "type",
        "service_account",
        "projectId",
        "project",
        "privateKeyId",
        "key-id",
        "privateKey",
        GCP_PRIVATE_KEY,
        "clientEmail",
        "sa@project.iam.gserviceaccount.com",
        "clientId",
        "1234");
  }

  private SftpBasicAuth sftpAuth(SftpConnection connection) {
    return (SftpBasicAuth) connection.getAuthType();
  }

  private String sftpPassword(SftpConnection connection) {
    return sftpAuth(connection).getPassword();
  }

  @Test
  void testExceptionConnection() {
    Map<String, Object> mysqlConnectionObject =
        Map.of(
            "authType", Map.of("password", "openmetadata-test"), "username1", "openmetadata-test");

    EntityMaskException thrown =
        Assertions.assertThrows(
            EntityMaskException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .maskServiceConnectionConfig(
                        mysqlConnectionObject, "Mysql", ServiceType.DATABASE));

    assertEquals(
        "Failed to mask 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());

    thrown =
        Assertions.assertThrows(
            EntityMaskException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .unmaskServiceConnectionConfig(
                        mysqlConnectionObject,
                        new MysqlConnection(),
                        "Mysql",
                        ServiceType.DATABASE));

    assertEquals(
        "Failed to unmask 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
  }

  @Test
  void testMicrosoftFabricClientSecretIsMaskedAndRestored() {
    MicrosoftFabricConnection original =
        fabricConnection(new ClientSecretAuthentication().withClientSecret(TOKEN));

    MicrosoftFabricConnection masked = maskFabric(original);
    assertEquals(
        getMaskedPassword(), ((ClientSecretAuthentication) masked.getAuthType()).getClientSecret());

    MicrosoftFabricConnection restored = unmaskFabric(masked, original);
    assertEquals(TOKEN, ((ClientSecretAuthentication) restored.getAuthType()).getClientSecret());
  }

  @Test
  void testMicrosoftFabricCertificateCredentialsAreMaskedAndRestored() {
    MicrosoftFabricConnection original =
        fabricConnection(
            new CertificateAuthentication()
                .withCertificate(FABRIC_CERTIFICATE)
                .withPrivateKey(FABRIC_PRIVATE_KEY)
                .withPrivateKeyPassphrase(FABRIC_PASSPHRASE));

    MicrosoftFabricConnection masked = maskFabric(original);
    assertEquals(
        List.of(getMaskedPassword(), getMaskedPassword(), getMaskedPassword()),
        certificateSecrets(masked));

    MicrosoftFabricConnection restored = unmaskFabric(masked, original);
    assertEquals(
        List.of(FABRIC_CERTIFICATE, FABRIC_PRIVATE_KEY, FABRIC_PASSPHRASE),
        certificateSecrets(restored));
  }

  private MicrosoftFabricConnection fabricConnection(Object authType) {
    return new MicrosoftFabricConnection()
        .withHostPort("workspace.datawarehouse.fabric.example.test")
        .withClientId("fabric-client-id")
        .withTenantId("fabric-tenant-id")
        .withAuthType(authType);
  }

  private MicrosoftFabricConnection maskFabric(MicrosoftFabricConnection connection) {
    return (MicrosoftFabricConnection)
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(connection, "MicrosoftFabric", ServiceType.DATABASE);
  }

  private MicrosoftFabricConnection unmaskFabric(
      MicrosoftFabricConnection masked, MicrosoftFabricConnection original) {
    return (MicrosoftFabricConnection)
        EntityMaskerFactory.createEntityMasker()
            .unmaskServiceConnectionConfig(
                masked, original, "MicrosoftFabric", ServiceType.DATABASE);
  }

  private List<String> certificateSecrets(MicrosoftFabricConnection connection) {
    CertificateAuthentication auth = (CertificateAuthentication) connection.getAuthType();
    return List.of(auth.getCertificate(), auth.getPrivateKey(), auth.getPrivateKeyPassphrase());
  }

  /**
   * Kafka's {@code consumerConfig} and {@code schemaRegistryConfig} declare their known secret keys
   * as password fields and treat every other string entry as a secret of the map ({@code
   * additionalProperties} with {@code format: password}). Both must be masked on read and restored
   * on write, while non-string settings keep their value.
   */
  @Test
  void testKafkaMapSecretsAreMaskedAndRestored() {
    KafkaConnection original =
        new KafkaConnection()
            .withBootstrapServers("broker:9092")
            .withConsumerConfig(
                new ConsumerConfig()
                    .withSaslOauthbearerClientSecret(OAUTH_CLIENT_SECRET)
                    .withAdditionalProperty(CUSTOM_SECRET_KEY, CUSTOM_SECRET)
                    .withAdditionalProperty("session.timeout.ms", 6000))
            .withSchemaRegistryConfig(
                new SchemaRegistryConfig().withBasicAuthUserInfo(REGISTRY_USER_INFO));

    KafkaConnection masked =
        (KafkaConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Kafka", ServiceType.MESSAGING);
    assertEquals(getMaskedPassword(), masked.getConsumerConfig().getSaslOauthbearerClientSecret());
    assertEquals(getMaskedPassword(), consumerConfigEntry(masked, CUSTOM_SECRET_KEY));
    assertEquals(getMaskedPassword(), masked.getSchemaRegistryConfig().getBasicAuthUserInfo());
    assertEquals(6000, consumerConfigEntry(masked, "session.timeout.ms"));

    KafkaConnection restored =
        (KafkaConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Kafka", ServiceType.MESSAGING);
    assertEquals(
        OAUTH_CLIENT_SECRET, restored.getConsumerConfig().getSaslOauthbearerClientSecret());
    assertEquals(CUSTOM_SECRET, consumerConfigEntry(restored, CUSTOM_SECRET_KEY));
    assertEquals(REGISTRY_USER_INFO, restored.getSchemaRegistryConfig().getBasicAuthUserInfo());
  }

  @Test
  void testRedpandaMapSecretsAreMaskedAndRestored() {
    RedpandaConnection original =
        new RedpandaConnection()
            .withBootstrapServers("broker:9092")
            .withConsumerConfig(
                new ConsumerConfig__1()
                    .withSslKeyPassword(KEY_PASSPHRASE)
                    .withAdditionalProperty(CUSTOM_SECRET_KEY, CUSTOM_SECRET));

    RedpandaConnection masked =
        (RedpandaConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Redpanda", ServiceType.MESSAGING);
    assertEquals(getMaskedPassword(), masked.getConsumerConfig().getSslKeyPassword());
    assertEquals(
        getMaskedPassword(),
        masked.getConsumerConfig().getAdditionalProperties().get(CUSTOM_SECRET_KEY));

    RedpandaConnection restored =
        (RedpandaConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Redpanda", ServiceType.MESSAGING);
    assertEquals(KEY_PASSPHRASE, restored.getConsumerConfig().getSslKeyPassword());
    assertEquals(
        CUSTOM_SECRET,
        restored.getConsumerConfig().getAdditionalProperties().get(CUSTOM_SECRET_KEY));
  }

  /**
   * A dbt HTTP agent keeps its repository token in {@code dbtHttpHeaders} - the only field the
   * config has for it - so the header values must be masked like any other password field.
   */
  @Test
  void testDbtHttpHeadersAreMaskedAndRestored() {
    IngestionPipeline original = dbtHttpPipeline();
    IngestionPipeline toMask = dbtHttpPipeline();

    EntityMaskerFactory.createEntityMasker().maskIngestionPipeline(toMask);
    assertEquals(getMaskedPassword(), dbtHttpHeader(toMask));

    EntityMaskerFactory.createEntityMasker().unmaskIngestionPipeline(toMask, original);
    assertEquals(GITLAB_TOKEN, dbtHttpHeader(toMask));
  }

  @Test
  void testCustomLLMHeadersAreMaskedAndRestored() {
    CustomLLMConnection original =
        new CustomLLMConnection()
            .withHeaders(new Headers().withAdditionalProperty("Authorization", LLM_HEADER_TOKEN));

    CustomLLMConnection masked =
        (CustomLLMConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "CustomLLM", ServiceType.LLM);
    assertEquals(
        getMaskedPassword(), masked.getHeaders().getAdditionalProperties().get("Authorization"));

    CustomLLMConnection restored =
        (CustomLLMConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "CustomLLM", ServiceType.LLM);
    assertEquals(
        LLM_HEADER_TOKEN, restored.getHeaders().getAdditionalProperties().get("Authorization"));
  }

  private Object consumerConfigEntry(KafkaConnection connection, String key) {
    return connection.getConsumerConfig().getAdditionalProperties().get(key);
  }

  private IngestionPipeline dbtHttpPipeline() {
    return new IngestionPipeline()
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DbtPipeline()
                        .withDbtConfigSource(
                            new DbtHttpConfig()
                                .withDbtHttpHeaders(
                                    new DbtHttpHeaders()
                                        .withAdditionalProperty("PRIVATE-TOKEN", GITLAB_TOKEN)))));
  }

  private Object dbtHttpHeader(IngestionPipeline pipeline) {
    DbtPipeline config = (DbtPipeline) pipeline.getSourceConfig().getConfig();
    return ((DbtHttpConfig) config.getDbtConfigSource())
        .getDbtHttpHeaders()
        .getAdditionalProperties()
        .get("PRIVATE-TOKEN");
  }
}
