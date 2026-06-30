package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for IngestionPipeline owner inheritance and trigger authorization.
 *
 * <p>Covers two coordinated changes that fix GH-27962 (Pylon-19838):
 *
 * <ul>
 *   <li>{@code IngestionPipelineRepository.setInheritedFields} now inherits owners from the
 *       referenced service / TestSuite / App, so {@code isOwner()} conditions on pipeline policies
 *       evaluate correctly.
 *   <li>{@code POST /v1/services/ingestionPipelines/trigger/{id}} now authorizes against {@code
 *       MetadataOperation.TRIGGER}.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IngestionPipelineOwnerInheritanceIT {

  private static final Date START_DATE = Date.from(Instant.parse("2022-06-10T15:06:47Z"));

  @Test
  void test_inheritedOwners_fromService(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String unique = UUID.randomUUID().toString().substring(0, 8);
    String userName = "ipinhowner_" + unique;
    User serviceOwner =
        adminClient
            .users()
            .create(
                new CreateUser().withName(userName).withEmail(userName + "@test.openmetadata.org"));

    try {
      DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
      DashboardService fetchedService =
          adminClient.dashboardServices().get(service.getId().toString());
      fetchedService.setOwners(List.of(serviceOwner.getEntityReference()));
      adminClient.dashboardServices().update(service.getId().toString(), fetchedService);

      try {
        IngestionPipeline pipeline =
            adminClient
                .ingestionPipelines()
                .create(
                    new CreateIngestionPipeline()
                        .withName(ns.prefix("ipinhPipeline"))
                        .withPipelineType(PipelineType.METADATA)
                        .withService(service.getEntityReference())
                        .withSourceConfig(
                            new SourceConfig().withConfig(new DashboardServiceMetadataPipeline()))
                        .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE)));

        try {
          IngestionPipeline withOwners =
              adminClient.ingestionPipelines().get(pipeline.getId().toString(), "owners");
          assertNotNull(withOwners.getOwners(), "Inherited owners should be populated");
          assertEquals(1, withOwners.getOwners().size(), "Pipeline should inherit one owner");
          EntityReference inherited = withOwners.getOwners().get(0);
          assertEquals(
              serviceOwner.getId(),
              inherited.getId(),
              "Inherited owner should match service owner");
          assertTrue(
              Boolean.TRUE.equals(inherited.getInherited()),
              "Owner inherited from the parent service must be marked inherited=true");
        } finally {
          adminClient.ingestionPipelines().delete(pipeline.getId().toString());
        }
      } finally {
        adminClient
            .dashboardServices()
            .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      }
    } finally {
      adminClient.users().delete(serviceOwner.getId());
    }
  }

  @Test
  void test_isOwnerPolicy_appliesToEditAndTrigger(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String unique = UUID.randomUUID().toString().substring(0, 8);

    Rule ownerRule =
        new Rule()
            .withName("pipelineOwnerEditAndTrigger")
            .withDescription("Allow owners to edit and trigger ingestion pipelines")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_ALL, MetadataOperation.TRIGGER))
            .withResources(List.of("ingestionPipeline"))
            .withCondition("isOwner()");
    Policy ownerPolicy =
        adminClient
            .policies()
            .create(
                new CreatePolicy()
                    .withName("ipauthPolicy_" + unique)
                    .withDescription("Owner-only policy for ingestion pipelines")
                    .withRules(List.of(ownerRule)));

    try {
      Role ownerRole =
          adminClient
              .roles()
              .create(
                  new CreateRole()
                      .withName("ipauthRole_" + unique)
                      .withPolicies(List.of(ownerPolicy.getFullyQualifiedName())));

      try {
        String ownerName = "ipauthowner_" + unique;
        User pipelineOwner =
            adminClient
                .users()
                .create(
                    new CreateUser()
                        .withName(ownerName)
                        .withEmail(ownerName + "@test.openmetadata.org")
                        .withRoles(List.of(ownerRole.getId())));

        String otherName = "ipauthother_" + unique;
        User otherUser =
            adminClient
                .users()
                .create(
                    new CreateUser()
                        .withName(otherName)
                        .withEmail(otherName + "@test.openmetadata.org"));

        try {
          DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
          DashboardService fetchedService =
              adminClient.dashboardServices().get(service.getId().toString());
          fetchedService.setOwners(List.of(pipelineOwner.getEntityReference()));
          adminClient.dashboardServices().update(service.getId().toString(), fetchedService);

          try {
            IngestionPipeline pipeline =
                adminClient
                    .ingestionPipelines()
                    .create(
                        new CreateIngestionPipeline()
                            .withName(ns.prefix("ipauthPipeline_" + unique))
                            .withPipelineType(PipelineType.METADATA)
                            .withService(service.getEntityReference())
                            .withSourceConfig(
                                new SourceConfig()
                                    .withConfig(new DashboardServiceMetadataPipeline()))
                            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE)));

            try {
              OpenMetadataClient ownerClient =
                  SdkClients.createClient(ownerName, ownerName, new String[] {});
              OpenMetadataClient otherClient =
                  SdkClients.createClient(otherName, otherName, new String[] {});

              // Owner can PATCH displayName.
              IngestionPipeline ownerEdit =
                  adminClient.ingestionPipelines().get(pipeline.getId().toString());
              ownerEdit.setDisplayName("owner-updated-display-name");
              ownerClient.ingestionPipelines().update(pipeline.getId().toString(), ownerEdit);

              // Non-owner cannot PATCH displayName.
              IngestionPipeline otherEdit =
                  adminClient.ingestionPipelines().get(pipeline.getId().toString());
              otherEdit.setDisplayName("non-owner-attempt");
              assertThrows(
                  Exception.class,
                  () ->
                      otherClient
                          .ingestionPipelines()
                          .update(pipeline.getId().toString(), otherEdit),
                  "Non-owner PATCH should be forbidden");

              // Owner can trigger.
              String triggerPath = "/v1/services/ingestionPipelines/trigger/" + pipeline.getId();
              ownerClient.getHttpClient().execute(HttpMethod.POST, triggerPath, null, Void.class);

              // Non-owner cannot trigger.
              assertThrows(
                  Exception.class,
                  () ->
                      otherClient
                          .getHttpClient()
                          .execute(HttpMethod.POST, triggerPath, null, Void.class),
                  "Non-owner trigger should be forbidden");
            } finally {
              adminClient.ingestionPipelines().delete(pipeline.getId().toString());
            }
          } finally {
            adminClient
                .dashboardServices()
                .delete(
                    service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
          }
        } finally {
          adminClient.users().delete(otherUser.getId());
          adminClient.users().delete(pipelineOwner.getId());
        }
      } finally {
        adminClient.roles().delete(ownerRole.getId());
      }
    } finally {
      adminClient.policies().delete(ownerPolicy.getId());
    }
  }

  @Test
  void test_ingestionPipelineDescriptorExposesTrigger() {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    ResourceDescriptorList resources =
        adminClient
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/policies/resources", null, ResourceDescriptorList.class);
    ResourceDescriptor descriptor =
        resources.getData().stream()
            .filter(rd -> "ingestionPipeline".equals(rd.getName()))
            .findFirst()
            .orElseThrow(
                () -> new AssertionError("ingestionPipeline resource descriptor not found"));
    assertTrue(
        descriptor.getOperations().contains(MetadataOperation.TRIGGER),
        "ingestionPipeline descriptor must expose Trigger so it is grantable scoped to "
            + "Ingestion Pipeline in the policy editor");
  }

  static class ResourceDescriptorList extends ResultList<ResourceDescriptor> {}
}
