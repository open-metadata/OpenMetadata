package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.type.EntityReference;

class OnboardingFingerprintTest {

  /**
   * A sparse read leaves a relationship list null where a hydrated read gives an empty list. Both
   * mean "nobody"; the approval an approver gave still covers the asset.
   */
  @Test
  void absentAndEmptyRelationshipsFingerprintTheSame() {
    var instance = instance();
    var sparse = new DataProduct().withName("p").withExperts(null).withReviewers(null);
    var hydrated = new DataProduct().withName("p").withExperts(List.of()).withReviewers(List.of());

    assertEquals(
        OnboardingFingerprint.of(instance, sparse), OnboardingFingerprint.of(instance, hydrated));
  }

  @Test
  void aRealChangeStillInvalidatesTheApproval() {
    var instance = instance();
    var before = new DataProduct().withName("p");
    var after =
        new DataProduct()
            .withName("p")
            .withReviewers(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")));

    assertNotEquals(
        OnboardingFingerprint.of(instance, before), OnboardingFingerprint.of(instance, after));
  }

  private static OnboardingInstance instance() {
    return new OnboardingInstance()
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("dataProduct"))
        .withConfiguration(
            new OnboardingPlaybook()
                .withEntityType(PlaybookEntityType.DATA_PRODUCT)
                .withOnboarding(new OnboardingConfiguration().withGates(List.of())));
  }
}
