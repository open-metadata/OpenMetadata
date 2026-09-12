package org.openmetadata.it.bootstrap;

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.jetty.HttpsConnectorFactory;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public final class SessionMultiNodeCluster {
  private static final AtomicReference<SessionMultiNodeCluster> INSTANCE = new AtomicReference<>();

  private final ForkedTestNode nodeA;
  private final ForkedTestNode nodeB;

  private SessionMultiNodeCluster(ForkedTestNode nodeA, ForkedTestNode nodeB) {
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

      ForkedTestNode nodeA = startNode();
      ForkedTestNode nodeB = startNode();
      SessionMultiNodeCluster cluster = new SessionMultiNodeCluster(nodeA, nodeB);
      INSTANCE.set(cluster);
      return cluster;
    }
  }

  public String nodeABaseUrl() {
    return nodeA.baseUrl();
  }

  public String nodeBBaseUrl() {
    return nodeB.baseUrl();
  }

  private static ForkedTestNode startNode() {
    OpenMetadataApplicationConfig config = TestSuiteBootstrap.createApplicationConfigCopy();
    resetPorts(config);
    final ForkedTestNode node = ForkedTestNode.start(config);
    TestSuiteBootstrap.registerAdditionalNode(node);
    return node;
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
