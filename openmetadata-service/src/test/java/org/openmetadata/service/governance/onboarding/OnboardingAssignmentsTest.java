package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * The design names six roles; four of them resolve to people through the asset. A team is a valid
 * holder of every one of them - "Assigned to Data Management" is a team, not a person - so the
 * filtering that drops deleted assignees must not drop teams with it.
 */
class OnboardingAssignmentsTest {
  @Test
  void aTeamNamedOnTheCheckSurvivesResolution() {
    Team team = team("data-management");
    var reads = new StubOnboardingReadContext().with(team);
    var step =
        step()
            .withAssignment(
                new OnboardingAssignment()
                    .withRole(OnboardingAssignment.Role.EXPLICIT)
                    .withAssignees(List.of(reference(team.getId(), Entity.TEAM, team.getName()))));

    var resolved =
        OnboardingAssignments.resolve(step, new Metric().withName("orders"), instance(), reads);

    assertEquals(List.of(team.getId()), resolved.stream().map(EntityReference::getId).toList());
  }

  @Test
  void aTeamThatOwnsTheDomainHoldsTheDomainStewardRole() {
    Team team = team("finance-stewards");
    Domain domain =
        (Domain)
            new Domain()
                .withId(UUID.randomUUID())
                .withName("finance")
                .withOwners(List.of(reference(team.getId(), Entity.TEAM, team.getName())));
    var reads = new StubOnboardingReadContext().with(domain).with(team);
    var metric =
        new Metric().withName("orders").withDomains(List.of(reference(domain, Entity.DOMAIN)));
    var step =
        step()
            .withAssignment(
                new OnboardingAssignment().withRole(OnboardingAssignment.Role.DOMAIN_OWNERS));

    var resolved = OnboardingAssignments.resolve(step, metric, instance(), reads);

    assertEquals(List.of(team.getId()), resolved.stream().map(EntityReference::getId).toList());
  }

  @Test
  void aDeletedAssigneeLeavesTheCheckUnassignedRatherThanFailing() {
    var reads = new StubOnboardingReadContext();
    var step =
        step()
            .withAssignment(
                new OnboardingAssignment()
                    .withRole(OnboardingAssignment.Role.EXPLICIT)
                    .withAssignees(
                        List.of(
                            new EntityReference()
                                .withId(UUID.randomUUID())
                                .withType(Entity.USER)
                                .withName("gone"))));

    assertTrue(
        OnboardingAssignments.resolve(step, new Metric().withName("orders"), instance(), reads)
            .isEmpty());
  }

  @Test
  void theCreatorHoldsTheProducerRoleWhenNoRoleWasChosen() {
    User creator = user("producer");
    var reads = new StubOnboardingReadContext().with(creator);

    var resolved =
        OnboardingAssignments.resolve(
            step(),
            new Metric().withName("orders"),
            instance().withCreator(reference(creator.getId(), Entity.USER, creator.getName())),
            reads);

    assertEquals(List.of(creator.getId()), resolved.stream().map(EntityReference::getId).toList());
  }

  private OnboardingStep step() {
    return new OnboardingStep()
        .withId("display-name")
        .withType(OnboardingCheckType.ATTRIBUTE)
        .withFieldPath("displayName");
  }

  private Team team(String name) {
    return new Team().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private User user(String name) {
    return new User().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private EntityReference reference(UUID id, String type, String name) {
    return new EntityReference().withId(id).withType(type).withName(name);
  }

  private EntityReference reference(Domain domain, String type) {
    return new EntityReference().withId(domain.getId()).withType(type).withName(domain.getName());
  }

  private OnboardingInstance instance() {
    return new OnboardingInstance()
        .withId(UUID.randomUUID())
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC))
        .withStage(OnboardingLifecycle.DRAFT)
        .withConfiguration(
            new OnboardingPlaybook()
                .withEntityType(PlaybookEntityType.METRIC)
                .withOnboarding(
                    new OnboardingConfiguration()
                        .withEnabled(true)
                        .withGates(
                            List.of(
                                new OnboardingGate()
                                    .withStage(OnboardingLifecycle.DRAFT)
                                    .withSteps(List.of(step()))))));
  }
}
