package org.openmetadata.it.bootstrap;

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.jetty.HttpsConnectorFactory;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public final class SessionMultiNodeCluster {
  private static final AtomicReference<SessionMultiNodeCluster> INSTANCE = new AtomicReference<>();

  private final DropwizardAppExtension<OpenMetadataApplicationConfig> nodeA;
  private final DropwizardAppExtension<OpenMetadataApplicationConfig> nodeB;

  private SessionMultiNodeCluster(
      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeA,
      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeB) {
    this.nodeA = nodeA;
    this.nodeB = nodeB;
  }

  public static SessionMultiNodeCluster getInstance() {
    SessionMultiNodeCluster existing = INSTANCE.get();
    if (existing != null) {
      return existing;
    }

    synchronized (SessionMultiNodeCluster.class) {
      existing = INSTANCE.get();
      if (existing != null) {
        return existing;
      }

      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeA = startNode();
      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeB = startNode();
      SessionMultiNodeCluster cluster = new SessionMultiNodeCluster(nodeA, nodeB);
      INSTANCE.set(cluster);
      return cluster;
    }
  }

  public String nodeABaseUrl() {
    return "http://localhost:" + nodeA.getLocalPort();
  }

  public String nodeBBaseUrl() {
    return "http://localhost:" + nodeB.getLocalPort();
  }

  private static DropwizardAppExtension<OpenMetadataApplicationConfig> startNode() {
    OpenMetadataApplicationConfig config = TestSuiteBootstrap.createApplicationConfigCopy();
    resetPorts(config);
    DropwizardAppExtension<OpenMetadataApplicationConfig> app =
        new DropwizardAppExtension<>(OpenMetadataApplication.class, config);
    try {
      app.before();
    } catch (Exception e) {
      throw new IllegalStateException("Failed to start additional OpenMetadata node", e);
    }
    TestSuiteBootstrap.registerAdditionalApp(app);
    return app;
  }

  private static void resetPorts(OpenMetadataApplicationConfig config) {
    if (config.getServerFactory() instanceof DefaultServerFactory serverFactory) {
      for (ConnectorFactory connectorFactory : serverFactory.getApplicationConnectors()) {
        if (connectorFactory instanceof HttpConnectorFactory httpConnectorFactory) {
          httpConnectorFactory.setPort(0);
        } else if (connectorFactory instanceof HttpsConnectorFactory httpsConnectorFactory) {
          httpsConnectorFactory.setPort(0);
        }
      }
      for (ConnectorFactory connectorFactory : serverFactory.getAdminConnectors()) {
        if (connectorFactory instanceof HttpConnectorFactory httpConnectorFactory) {
          httpConnectorFactory.setPort(0);
        } else if (connectorFactory instanceof HttpsConnectorFactory httpsConnectorFactory) {
          httpsConnectorFactory.setPort(0);
        }
      }
    }
  }
}
