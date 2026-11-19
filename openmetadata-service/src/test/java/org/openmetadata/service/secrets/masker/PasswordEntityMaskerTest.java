package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.utils.SupersetApiConnection;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dasboard.powerbi.GCSConfig;
import org.openmetadata.schema.services.connections.dashboard.DomoDashboardConnection;
import org.openmetadata.schema.services.connections.dashboard.PowerBIConnection;
import org.openmetadata.schema.services.connections.dashboard.QlikSenseConnection;
import org.openmetadata.schema.services.connections.dashboard.SapS4HanaConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.qlikSense.QlikCertificateValues;
import org.openmetadata.schema.services.connections.dashboard.sapS4Hana.SapS4HanaOAuthCredentials;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.DataStorageConfig;
import org.openmetadata.schema.services.connections.database.DeltaLakeConnection;
import org.openmetadata.schema.services.connections.database.MssqlConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig__1;
import org.openmetadata.schema.services.connections.database.common.GcpCloudSqlConfig;
import org.openmetadata.schema.services.connections.database.databricks.DatabricksOAuth;
import org.openmetadata.schema.services.connections.database.databricks.PersonalAccessToken;
import org.openmetadata.schema.services.connections.database.datalake.S3Config;
import org.openmetadata.schema.services.connections.database.deltalake.MetastoreConfig;
import org.openmetadata.schema.services.connections.database.deltalake.StorageConfig;
import org.openmetadata.schema.services.connections.database.deltalake.metastore.MetastoreDbConnection;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.drive.sftp.SftpKeyAuth;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.services.connections.pipeline.DatabricksPipelineConnection;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.service.exception.EntityMaskException;

public class PasswordEntityMaskerTest extends TestEntityMasker {
  private static final String TOKEN = "openmetadata-token";
  private static final String ALPHA_KEY = "alpha-api-key";
  private static final String BETA_KEY = "beta-api-key";
  private static final String SFTP_PASSWORD = "openmetadata-sftp-secret";
  private static final String NESTED_SECRET = "openmetadata-nested-secret";
  private static final String GCP_PRIVATE_KEY = "openmetadata-gcp-private-key";

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

    McpConnection restored =
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

    McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(reordered, original, "Mcp", ServiceType.MCP);

    assertEquals(BETA_KEY, restored.getServers().get(0).getApiKey());
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

    McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(edited, original, "Mcp", ServiceType.MCP);

    assertEquals(ALPHA_KEY, restored.getServers().get(0).getApiKey());
    assertEquals(BETA_KEY, restored.getServers().get(1).getApiKey());
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
    Map<String, Object> serialized =
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
  void testDatabricksPipelineTokenFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "hostPort",
            "dbc.cloud.databricks.com:443",
            "authType",
            Map.of("token", "dapi-secret-token"));

    DatabricksPipelineConnection masked =
        (DatabricksPipelineConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(
                    serialized, "DatabricksPipeline", ServiceType.PIPELINE);

    assertEquals(getMaskedPassword(), ((PersonalAccessToken) masked.getAuthType()).getToken());
  }

  @Test
  void testDatabricksPipelineClientSecretFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "hostPort",
            "dbc.cloud.databricks.com:443",
            "authType",
            Map.of("clientId", "client-id", "clientSecret", "oauth-client-secret"));

    DatabricksPipelineConnection masked =
        (DatabricksPipelineConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(
                    serialized, "DatabricksPipeline", ServiceType.PIPELINE);

    DatabricksOAuth auth = (DatabricksOAuth) masked.getAuthType();
    assertEquals(getMaskedPassword(), auth.getClientSecret());
    assertEquals("client-id", auth.getClientId());
  }

  @Test
  void testPowerBiGcsPrivateKeyFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
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
    Map<String, Object> serialized =
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
    Map<String, Object> serialized =
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
    Map<String, Object> serialized =
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

    SSISConnection masked = (SSISConnection) mask(serialized, "SSIS", ServiceType.PIPELINE);

    MssqlConnection database = masked.getDatabaseConnection();
    assertEquals(
        getMaskedPassword(),
        ((ValidateSSLClientConfig) database.getSslConfig()).getCaCertificate());
  }

  @Test
  void testQlikSenseCertificateValuesFromSerializedConfigAreMasked() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "QlikSense",
            "hostPort",
            "https://qlik:4242",
            "certificates",
            Map.of("sslConfig", Map.of("caCertificate", NESTED_SECRET, "sslKey", NESTED_SECRET)));

    QlikSenseConnection masked =
        (QlikSenseConnection) mask(serialized, "QlikSense", ServiceType.DASHBOARD);

    ValidateSSLClientConfig ssl =
        (ValidateSSLClientConfig) ((QlikCertificateValues) masked.getCertificates()).getSslConfig();
    assertEquals(getMaskedPassword(), ssl.getCaCertificate());
    assertEquals(getMaskedPassword(), ssl.getSslKey());
  }

  @Test
  void testSapS4HanaOAuthClientSecretFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
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

    SapS4HanaConnection masked =
        (SapS4HanaConnection) mask(serialized, "SapS4Hana", ServiceType.DASHBOARD);

    assertEquals(
        getMaskedPassword(), ((SapS4HanaOAuthCredentials) masked.getAuthType()).getClientSecret());
  }

  @Test
  void testSampleDataStorageS3KeyFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "Postgres",
            "hostPort",
            "postgres:5432",
            "username",
            "admin",
            "database",
            "db",
            "sampleDataStorageConfig",
            Map.of(
                "config",
                Map.of(
                    "bucketName",
                    "samples",
                    "storageConfig",
                    Map.of("awsRegion", "us-east-1", "awsSecretAccessKey", NESTED_SECRET))));

    PostgresConnection masked =
        (PostgresConnection) mask(serialized, "Postgres", ServiceType.DATABASE);

    DataStorageConfig config = (DataStorageConfig) masked.getSampleDataStorageConfig().getConfig();
    assertEquals(
        getMaskedPassword(), ((AWSCredentials) config.getStorageConfig()).getAwsSecretAccessKey());
  }

  @Test
  void testEmptySampleDataStorageConfigStaysEmpty() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "Postgres",
            "hostPort",
            "postgres:5432",
            "username",
            "admin",
            "database",
            "db",
            "sampleDataStorageConfig",
            Map.of("config", Map.of()));

    PostgresConnection masked =
        (PostgresConnection) mask(serialized, "Postgres", ServiceType.DATABASE);

    assertEquals(Map.of(), masked.getSampleDataStorageConfig().getConfig());
  }

  @Test
  void testDeltaLakeMetastoreDbPasswordFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "DeltaLake",
            "configSource",
            Map.of(
                "connection",
                Map.of(
                    "metastoreDb",
                    "jdbc:mysql://metastore:3306/db",
                    "username",
                    "hive",
                    "password",
                    NESTED_SECRET)));

    DeltaLakeConnection masked =
        (DeltaLakeConnection) mask(serialized, "DeltaLake", ServiceType.DATABASE);

    MetastoreConfig metastore = (MetastoreConfig) masked.getConfigSource();
    assertEquals(
        getMaskedPassword(), ((MetastoreDbConnection) metastore.getConnection()).getPassword());
  }

  @Test
  void testDeltaLakeStorageS3KeyFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "DeltaLake",
            "configSource",
            Map.of(
                "connection",
                Map.of(
                    "securityConfig",
                    Map.of("awsRegion", "us-east-1", "awsSecretAccessKey", NESTED_SECRET))));

    DeltaLakeConnection masked =
        (DeltaLakeConnection) mask(serialized, "DeltaLake", ServiceType.DATABASE);

    S3Config s3 = (S3Config) ((StorageConfig) masked.getConfigSource()).getConnection();
    assertEquals(getMaskedPassword(), s3.getSecurityConfig().getAwsSecretAccessKey());
  }

  /** Released 2.0 versions typed a storage config as a metastore config and added its appName. */
  @Test
  void testDeltaLakeStorageS3KeySavedAsMetastoreConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "type",
            "DeltaLake",
            "configSource",
            Map.of(
                "appName",
                "OpenMetadata",
                "connection",
                Map.of(
                    "securityConfig",
                    Map.of("awsRegion", "us-east-1", "awsSecretAccessKey", NESTED_SECRET))));

    DeltaLakeConnection masked =
        (DeltaLakeConnection) mask(serialized, "DeltaLake", ServiceType.DATABASE);

    S3Config s3 = (S3Config) ((MetastoreConfig) masked.getConfigSource()).getConnection();
    assertEquals(getMaskedPassword(), s3.getSecurityConfig().getAwsSecretAccessKey());
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
}
