package org.openmetadata.it.bootstrap;

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.jetty.HttpsConnectorFactory;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SessionMultiNodeCluster {
  private static final Logger LOG = LoggerFactory.getLogger(SessionMultiNodeCluster.class);
  private static final String PARALLEL_EXECUTION_PROPERTY =
      "junit.jupiter.execution.parallel.enabled";
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

      requireIsolatedFork();
      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeA = startNode();
      DropwizardAppExtension<OpenMetadataApplicationConfig> nodeB;
      try {
        nodeB = startNode();
      } catch (RuntimeException e) {
        // Leaving the first node up while INSTANCE stays null would let the next call start a third
        // one, and each extra node re-registers the process-wide singletons every other suite in
        // this fork is already using.
        stopQuietly(nodeA);
        throw e;
      }
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
      // A node that fails partway through run() has already claimed JVM-wide singletons and
      // connection pools, and it is never handed to registerAdditionalApp, so nothing else would
      // ever stop it.
      stopQuietly(app);
      throw new IllegalStateException("Failed to start additional OpenMetadata node", e);
    }
    TestSuiteBootstrap.registerAdditionalApp(app);
    return app;
  }

  /**
   * The extra nodes started here replace this JVM's singletons -- the lifecycle dispatcher, the
   * schedulers, the search repository -- and join the same clustered Quartz job store, so every
   * suite sharing the fork sees them move underneath it. Failing up front turns a lane
   * misconfiguration into an immediate, self-describing error instead of a corrupted run whose
   * symptoms surface later in an unrelated test.
   */
  private static void requireIsolatedFork() {
    if (Boolean.parseBoolean(System.getProperty(PARALLEL_EXECUTION_PROPERTY))) {
      throw new IllegalStateException(
          "A multi-node suite is running in a fork configured for parallel execution. Add the class "
              + "to integrationTests.multiNodeTests, to every isolated-tests <includes> and every "
              + "parallel-tests <excludes> in openmetadata-integration-tests/pom.xml, and tag it "
              + "@Tag(\"multi-node\").");
    }
  }

  private static void stopQuietly(DropwizardAppExtension<OpenMetadataApplicationConfig> app) {
    try {
      app.after();
    } catch (Exception e) {
      LOG.warn("Failed to stop a partially started OpenMetadata node", e);
    }
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
