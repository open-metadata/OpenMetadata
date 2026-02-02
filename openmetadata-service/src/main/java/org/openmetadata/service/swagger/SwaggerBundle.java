package org.openmetadata.service.swagger;

import io.dropwizard.assets.AssetsBundle;
import io.dropwizard.core.Configuration;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.views.common.ViewBundle;

/**
 * A Dropwizard 5.0 compatible Swagger bundle that serves Swagger UI and the generated OpenAPI spec.
 * This replaces the io.federecio.dropwizard.swagger.SwaggerBundle which is not yet compatible with
 * Dropwizard 5.0.
 *
 * <p>The OpenAPI spec is generated at build time by swagger-maven-plugin-jakarta and placed in
 * target/classes/assets/swagger.json
 */
public abstract class SwaggerBundle<T extends Configuration> implements ConfiguredBundle<T> {

  @Override
  public void initialize(Bootstrap<?> bootstrap) {
    bootstrap.addBundle(new ViewBundle<>());
    bootstrap.addBundle(
        new AssetsBundle("/swagger-ui", "/swagger-ui", "index.html", "swagger-ui-assets"));
  }

  @Override
  public void run(T configuration, Environment environment) {
    SwaggerBundleConfiguration swaggerConfig = getSwaggerBundleConfiguration(configuration);
    if (swaggerConfig != null) {
      environment
          .jersey()
          .register(new SwaggerResource(swaggerConfig.getResourcePackage(), swaggerConfig));
    }
  }

  protected abstract SwaggerBundleConfiguration getSwaggerBundleConfiguration(T configuration);
}
