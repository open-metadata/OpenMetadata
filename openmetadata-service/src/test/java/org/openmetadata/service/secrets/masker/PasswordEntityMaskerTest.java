package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.utils.SupersetApiConnection;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dasboard.powerbi.GCSConfig;
import org.openmetadata.schema.services.connections.dashboard.DomoDashboardConnection;
import org.openmetadata.schema.services.connections.dashboard.PowerBIConnection;
import org.openmetadata.schema.services.connections.dashboard.QlikSenseConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.qlikSense.QlikCertificateValues;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.MssqlConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig__1;
import org.openmetadata.schema.services.connections.database.common.GcpCloudSqlConfig;
import org.openmetadata.schema.services.connections.database.databricks.DatabricksOAuth;
import org.openmetadata.schema.services.connections.database.databricks.PersonalAccessToken;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.drive.sftp.SftpKeyAuth;
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
