package org.openmetadata.catalog.resources;

import com.wix.mysql.EmbeddedMysql;
import com.wix.mysql.config.MysqldConfig;
import com.wix.mysql.config.SchemaConfig;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.ZoneId;
import java.util.TimeZone;

import static com.wix.mysql.distribution.Version.v5_7_27;

public class EmbeddedMySqlSupport implements BeforeAllCallback, AfterAllCallback {
  public static final Logger LOG = LoggerFactory.getLogger(EmbeddedMySqlSupport.class);
  static EmbeddedMysql embeddedMysql;

  @Override
  public void beforeAll(ExtensionContext extensionContext) {
    if (embeddedMysql == null) {
      MysqldConfig config = MysqldConfig.aMysqldConfig(v5_7_27)
              .withPort(3307)
              .withTimeZone(TimeZone.getTimeZone(ZoneId.of("UTC")))
              .withUser("test", "")
              .build();

      SchemaConfig schemaConfig = SchemaConfig.aSchemaConfig("catalog_test_db").build();

      embeddedMysql = EmbeddedMysql.anEmbeddedMysql(config).addSchema(schemaConfig).start();
      LOG.info("Embedded MySQL is started");

      Flyway flyway = Flyway.configure()
              // TODO Remove hardcoding
              .dataSource("jdbc:mysql://localhost:3307/catalog_test_db?useSSL=false&serverTimezone=UTC", "test", "")
              .sqlMigrationPrefix("v")
              .load();
      flyway.clean();
      flyway.migrate();
      LOG.info("Flyway migration is complete");
    } else {
      LOG.info("Embedded MySQL is already running");
    }

  }

  @Override
  public void afterAll(ExtensionContext extensionContext) {
    if (embeddedMysql != null) {
      LOG.info("Stopping the embedded db");
      embeddedMysql.stop();
      embeddedMysql = null;
    }
  }
}
