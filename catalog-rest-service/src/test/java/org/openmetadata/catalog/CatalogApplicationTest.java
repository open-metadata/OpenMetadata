package org.openmetadata.catalog;


import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import io.dropwizard.testing.junit5.DropwizardExtensionsSupport;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.catalog.resources.EmbeddedMySqlSupport;

import javax.ws.rs.client.WebTarget;

@ExtendWith(EmbeddedMySqlSupport.class)
@ExtendWith(DropwizardExtensionsSupport.class)
public abstract class CatalogApplicationTest {
  private static final String CONFIG_PATH;
  public static final DropwizardAppExtension<CatalogApplicationConfig> APP;

  static {
    CONFIG_PATH = ResourceHelpers.resourceFilePath("catalog-secure-test.yaml");
    APP = new DropwizardAppExtension<>(CatalogApplication.class, CONFIG_PATH);
  }

  public static WebTarget getResource(String collection) {
    String targetURI = "http://localhost:" + APP.getLocalPort() + "/api/v1/" + collection;
    return APP.client().target(targetURI);
  }
}