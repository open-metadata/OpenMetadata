/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.operator.unit;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.fabric8.kubernetes.api.model.EnvVar;
import io.fabric8.kubernetes.api.model.EnvVarBuilder;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.PodSecurityContext;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.CronOMJobStatus;
import org.openmetadata.operator.model.OMJobPhase;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.openmetadata.operator.model.OMJobStatus;

/**
 * Tests that validate Java models match the CRD schema definitions.
 * Ensures consistency between the operator code and Kubernetes CRD specs.
 */
class CRDSchemaValidationTest {

  private static Map<String, Object> omJobCrd;
  private static Map<String, Object> cronOMJobCrd;
  private static final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

  @BeforeAll
  @SuppressWarnings("unchecked")
  static void loadCRDs() throws IOException {
    try (InputStream omJobStream =
            CRDSchemaValidationTest.class.getResourceAsStream("/crds/omjob-crd.yaml");
        InputStream cronOMJobStream =
            CRDSchemaValidationTest.class.getResourceAsStream("/crds/cronomjob-crd.yaml")) {
      omJobCrd = yamlMapper.readValue(omJobStream, Map.class);
      cronOMJobCrd = yamlMapper.readValue(cronOMJobStream, Map.class);
    }
  }

  @Test
  void testOMJobCrdLoaded() {
    assertNotNull(omJobCrd);
    assertEquals("CustomResourceDefinition", omJobCrd.get("kind"));
  }

  @Test
  void testCronOMJobCrdLoaded() {
    assertNotNull(cronOMJobCrd);
    assertEquals("CustomResourceDefinition", cronOMJobCrd.get("kind"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void testOMJobModelContainsAllCrdSpecFields() {
    // Get the CRD spec schema
    Map<String, Object> spec = (Map<String, Object>) omJobCrd.get("spec");
    List<Map<String, Object>> versions = (List<Map<String, Object>>) spec.get("versions");
    Map<String, Object> v1 = versions.get(0);
    Map<String, Object> schema = (Map<String, Object>) v1.get("schema");
    Map<String, Object> openAPIV3Schema = (Map<String, Object>) schema.get("openAPIV3Schema");
    Map<String, Object> properties = (Map<String, Object>) openAPIV3Schema.get("properties");
    Map<String, Object> specProps =
        (Map<String, Object>) ((Map<String, Object>) properties.get("spec")).get("properties");

    // Verify mainPodSpec fields exist in Java model
    Map<String, Object> mainPodSpecProps =
        (Map<String, Object>)
            ((Map<String, Object>) specProps.get("mainPodSpec")).get("properties");

    Set<String> expectedPodSpecFields = mainPodSpecProps.keySet();

    // Create a model and verify all fields can be set
    OMJobSpec.OMJobPodSpec podSpec = new OMJobSpec.OMJobPodSpec();

    // Verify core fields are present in Java model
    assertDoesNotThrow(
        () -> {
          podSpec.setImage("test");
          podSpec.setImagePullPolicy("Always");
          podSpec.setCommand(List.of("python"));
          podSpec.setEnv(List.of());
          podSpec.setServiceAccountName("sa");
          podSpec.setNodeSelector(Map.of());
          podSpec.setSecurityContext(new PodSecurityContext());
          podSpec.setLabels(Map.of());
          podSpec.setAnnotations(Map.of());
        });

    // Verify expected fields are in CRD
    assertTrue(expectedPodSpecFields.contains("image"), "CRD should have image field");
    assertTrue(
        expectedPodSpecFields.contains("imagePullPolicy"), "CRD should have imagePullPolicy field");
    assertTrue(expectedPodSpecFields.contains("command"), "CRD should have command field");
    assertTrue(expectedPodSpecFields.contains("env"), "CRD should have env field");
    assertTrue(
        expectedPodSpecFields.contains("serviceAccountName"),
        "CRD should have serviceAccountName field");
    assertTrue(expectedPodSpecFields.contains("resources"), "CRD should have resources field");
    assertTrue(
        expectedPodSpecFields.contains("nodeSelector"), "CRD should have nodeSelector field");
    assertTrue(
        expectedPodSpecFields.contains("securityContext"), "CRD should have securityContext field");
    assertTrue(expectedPodSpecFields.contains("labels"), "CRD should have labels field");
    assertTrue(expectedPodSpecFields.contains("annotations"), "CRD should have annotations field");
  }

  @Test
  @SuppressWarnings("unchecked")
  void testOMJobStatusPhaseEnumMatchesCrd() {
    // Get the CRD status schema
    Map<String, Object> spec = (Map<String, Object>) omJobCrd.get("spec");
    List<Map<String, Object>> versions = (List<Map<String, Object>>) spec.get("versions");
    Map<String, Object> v1 = versions.get(0);
    Map<String, Object> schema = (Map<String, Object>) v1.get("schema");
    Map<String, Object> openAPIV3Schema = (Map<String, Object>) schema.get("openAPIV3Schema");
    Map<String, Object> properties = (Map<String, Object>) openAPIV3Schema.get("properties");
    Map<String, Object> statusProps =
        (Map<String, Object>) ((Map<String, Object>) properties.get("status")).get("properties");
    Map<String, Object> phaseProps = (Map<String, Object>) statusProps.get("phase");
    List<String> crdPhases = (List<String>) phaseProps.get("enum");

    // Verify all CRD phases are representable in Java
    Set<String> expectedPhases = Set.of(crdPhases.toArray(new String[0]));

    assertTrue(expectedPhases.contains("Pending"), "Should have Pending phase");
    assertTrue(expectedPhases.contains("Running"), "Should have Running phase");
    assertTrue(
        expectedPhases.contains("ExitHandlerRunning"), "Should have ExitHandlerRunning phase");
    assertTrue(expectedPhases.contains("Succeeded"), "Should have Succeeded phase");
    assertTrue(expectedPhases.contains("Failed"), "Should have Failed phase");

    // Verify OMJobPhase enum has all expected phases and matches CRD values
    assertEquals("Pending", OMJobPhase.PENDING.getValue());
    assertEquals("Running", OMJobPhase.RUNNING.getValue());
    assertEquals("ExitHandlerRunning", OMJobPhase.EXIT_HANDLER_RUNNING.getValue());
    assertEquals("Succeeded", OMJobPhase.SUCCEEDED.getValue());
    assertEquals("Failed", OMJobPhase.FAILED.getValue());

    // Verify OMJobStatus can hold all phases
    OMJobStatus status = new OMJobStatus();
    assertDoesNotThrow(
        () -> {
          status.setPhase(OMJobPhase.PENDING);
          status.setPhase(OMJobPhase.RUNNING);
          status.setPhase(OMJobPhase.EXIT_HANDLER_RUNNING);
          status.setPhase(OMJobPhase.SUCCEEDED);
          status.setPhase(OMJobPhase.FAILED);
        });
  }

  @Test
  @SuppressWarnings("unchecked")
  void testCronOMJobModelContainsAllCrdSpecFields() {
    // Get the CRD spec schema
    Map<String, Object> spec = (Map<String, Object>) cronOMJobCrd.get("spec");
    List<Map<String, Object>> versions = (List<Map<String, Object>>) spec.get("versions");
    Map<String, Object> v1 = versions.get(0);
    Map<String, Object> schema = (Map<String, Object>) v1.get("schema");
    Map<String, Object> openAPIV3Schema = (Map<String, Object>) schema.get("openAPIV3Schema");
    Map<String, Object> properties = (Map<String, Object>) openAPIV3Schema.get("properties");
    Map<String, Object> specProps =
        (Map<String, Object>) ((Map<String, Object>) properties.get("spec")).get("properties");

    Set<String> expectedSpecFields = specProps.keySet();

    // Verify expected fields are in CRD
    assertTrue(expectedSpecFields.contains("schedule"), "CRD should have schedule field");
    assertTrue(expectedSpecFields.contains("timeZone"), "CRD should have timeZone field");
    assertTrue(expectedSpecFields.contains("suspend"), "CRD should have suspend field");
    assertTrue(expectedSpecFields.contains("omJobSpec"), "CRD should have omJobSpec field");

    // Verify Java model can set all fields
    CronOMJobSpec cronSpec = new CronOMJobSpec();
    assertDoesNotThrow(
        () -> {
          cronSpec.setSchedule("0 * * * *");
          cronSpec.setTimeZone("UTC");
          cronSpec.setSuspend(false);
          cronSpec.setStartingDeadlineSeconds(300);
          cronSpec.setSuccessfulJobsHistoryLimit(3);
          cronSpec.setFailedJobsHistoryLimit(1);
          cronSpec.setOmJobSpec(new OMJobSpec());
        });
  }

  @Test
  void testOMJobResourceCanBeFullyPopulated() {
    // Create a complete OMJobResource and verify all fields work
    List<EnvVar> envVars =
        List.of(
            new EnvVarBuilder().withName("pipelineType").withValue("metadata").build(),
            new EnvVarBuilder().withName("config").withValue("{}").build());

    PodSecurityContext securityContext = new PodSecurityContext();
    securityContext.setRunAsNonRoot(true);
    securityContext.setRunAsUser(1000L);

    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("openmetadata/ingestion:latest");
    mainPodSpec.setImagePullPolicy("IfNotPresent");
    mainPodSpec.setCommand(List.of("python", "main.py"));
    mainPodSpec.setEnv(envVars);
    mainPodSpec.setServiceAccountName("openmetadata-sa");
    mainPodSpec.setNodeSelector(Map.of("node-type", "ingestion"));
    mainPodSpec.setSecurityContext(securityContext);
    mainPodSpec.setLabels(Map.of("app", "openmetadata"));
    mainPodSpec.setAnnotations(Map.of("prometheus.io/scrape", "true"));

    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("openmetadata/ingestion:latest");
    exitHandlerSpec.setCommand(List.of("python", "exit_handler.py"));
    exitHandlerSpec.setEnv(envVars);

    OMJobSpec spec = new OMJobSpec();
    spec.setMainPodSpec(mainPodSpec);
    spec.setExitHandlerSpec(exitHandlerSpec);
    spec.setTtlSecondsAfterFinished(3600);

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName("test-omjob")
            .withNamespace("openmetadata")
            .withLabels(Map.of("app.kubernetes.io/name", "openmetadata"))
            .build();

    OMJobResource resource = new OMJobResource();
    resource.setApiVersion("pipelines.openmetadata.org/v1");
    resource.setKind("OMJob");
    resource.setMetadata(metadata);
    resource.setSpec(spec);
    resource.setStatus(new OMJobStatus());

    // Verify resource is valid
    assertNotNull(resource.getMetadata());
    assertNotNull(resource.getSpec());
    assertNotNull(resource.getSpec().getMainPodSpec());
    assertNotNull(resource.getSpec().getExitHandlerSpec());
    assertEquals("openmetadata/ingestion:latest", resource.getSpec().getMainPodSpec().getImage());
    assertEquals(2, resource.getSpec().getMainPodSpec().getEnv().size());
  }

  @Test
  void testCronOMJobResourceCanBeFullyPopulated() {
    // Create a complete CronOMJobResource
    OMJobSpec.OMJobPodSpec podSpec = new OMJobSpec.OMJobPodSpec();
    podSpec.setImage("openmetadata/ingestion:latest");
    podSpec.setCommand(List.of("python", "main.py"));

    OMJobSpec omJobSpec = new OMJobSpec();
    omJobSpec.setMainPodSpec(podSpec);
    omJobSpec.setExitHandlerSpec(podSpec);

    CronOMJobSpec cronSpec = new CronOMJobSpec();
    cronSpec.setSchedule("0 * * * *");
    cronSpec.setTimeZone("UTC");
    cronSpec.setSuspend(false);
    cronSpec.setStartingDeadlineSeconds(300);
    cronSpec.setSuccessfulJobsHistoryLimit(3);
    cronSpec.setFailedJobsHistoryLimit(1);
    cronSpec.setOmJobSpec(omJobSpec);

    ObjectMeta metadata =
        new ObjectMetaBuilder().withName("test-cronomjob").withNamespace("openmetadata").build();

    CronOMJobResource resource = new CronOMJobResource();
    resource.setApiVersion("pipelines.openmetadata.org/v1");
    resource.setKind("CronOMJob");
    resource.setMetadata(metadata);
    resource.setSpec(cronSpec);
    resource.setStatus(new CronOMJobStatus());

    // Verify resource is valid
    assertNotNull(resource.getMetadata());
    assertNotNull(resource.getSpec());
    assertEquals("0 * * * *", resource.getSpec().getSchedule());
    assertEquals("UTC", resource.getSpec().getTimeZone());
    assertFalse(resource.getSpec().getSuspend());
  }
}
