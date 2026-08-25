package org.openmetadata.it.factories;

import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Factory for accessing predefined Policy entities in integration tests.
 *
 * <p>Uses the SDK client to access policies that are predefined in the OpenMetadata system.
 */
public class PolicyTestFactory {

  /**
   * Get the DataConsumerPolicy (predefined in the system).
   */
  public static Policy getDataConsumerPolicy(TestNamespace ns) {
    return getPolicyByName("DataConsumerPolicy");
  }

  /**
   * Get the DataStewardPolicy (predefined in the system).
   */
  public static Policy getDataStewardPolicy(TestNamespace ns) {
    return getPolicyByName("DataStewardPolicy");
  }

  /**
   * Get the OrganizationPolicy (predefined in the system).
   */
  public static Policy getOrganizationPolicy(TestNamespace ns) {
    return getPolicyByName("OrganizationPolicy");
  }

  /**
   * Get a policy by name.
   */
  public static Policy getPolicyByName(String policyName) {
    try {
      OpenMetadataClient client = SdkClients.adminClient();
      return client.policies().getByName(policyName);
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Policy not found: " + policyName, e);
    }
  }
}
