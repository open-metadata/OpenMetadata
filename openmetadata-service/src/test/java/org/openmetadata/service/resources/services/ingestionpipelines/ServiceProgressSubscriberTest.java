/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.macasaet.fernet.Key;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.monitoring.IngestionProgressTracker.ServiceProgressSnapshot;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.ActivePersonaContext;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.RuleEvaluator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Isolated("swaps the secrets manager, masker and Fernet keys")
class ServiceProgressSubscriberTest {
  private final Authorizer authorizer = mock(Authorizer.class);
  private final SecurityContext caller = mock(SecurityContext.class);
  private final IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
  private final EntityReference service =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withType(Entity.DATABASE_SERVICE)
          .withFullyQualifiedName("svc");
  private MockedStatic<Entity> entities;
  private SecretsManager originalManager;
  private EntityMasker originalMasker;
  private List<Key> originalKeys;
  private final UUID pipelineId = UUID.randomUUID();
  private IngestionPipeline pipeline;

  @BeforeEach
  void setUp() {
    entities = mockStatic(Entity.class);
    entities
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(repository);
    when(repository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    pipeline =
        new IngestionPipeline()
            .withId(pipelineId)
            .withName("metadata")
            .withFullyQualifiedName("svc.metadata")
            .withPipelineType(PipelineType.METADATA)
            .withService(service)
            .withSourceConfig(new SourceConfig().withConfig(Map.of("type", "DatabaseMetadata")));
    when(repository.getByName(
            isNull(), anyString(), any(Fields.class), any(RelationIncludes.class), anyBoolean()))
        .thenAnswer(call -> pipeline);
    originalManager = SecretsManagerFactory.getSecretsManager();
    originalMasker = EntityMaskerFactory.getEntityMasker();
    originalKeys = Fernet.getInstance().getCachedKeys();
    Fernet.getInstance().setFernetKey("mFNuF9gyyS4zNItmwvFq8wAf9TUFnNwj6m6pW1P5RjE=");
    SecretsManagerFactory.setSecretsManager(null);
    SecretsManagerFactory.createSecretsManager(new SecretsManagerConfiguration(), "progress-tests");
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
  }

  @AfterEach
  void tearDown() {
    ImpersonationContext.clear();
    ActivePersonaContext.clear();
    entities.close();
    SecretsManagerFactory.setSecretsManager(originalManager);
    EntityMaskerFactory.setEntityMasker(originalMasker);
    Fernet.getInstance()
        .setFernetKey(
            originalKeys == null
                ? null
                : originalKeys.stream().map(Key::serialise).collect(Collectors.joining(",")));
  }

  private ServiceProgressSubscriber subscriber() {
    return new ServiceProgressSubscriber(
        authorizer, caller, new OpenMetadataApplicationConfig(), service);
  }

  private ServiceProgressSnapshot event() {
    return new ServiceProgressSnapshot(
        pipelineId,
        new ServiceProgressEvent()
            .withPipelineFqn("svc.metadata")
            .withRunId(UUID.randomUUID().toString()));
  }

  @ParameterizedTest
  @EnumSource(
      value = MetadataOperation.class,
      names = {"VIEW_BASIC", "VIEW_ALL"})
  void omitsEventsWhenEitherPipelineViewCheckIsDenied(MetadataOperation denied) {
    doAnswer(
            call -> {
              OperationContext operation = call.getArgument(1);
              if (operation.getOperations(call.getArgument(2)).contains(denied)) {
                throw new AuthorizationException("Pipeline is restricted");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(OperationContext.class), any());
    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @ParameterizedTest
  @EnumSource(
      value = MetadataOperation.class,
      names = {"VIEW_BASIC", "VIEW_ALL"})
  void appliesPermissionChangesWithoutReconnecting(MetadataOperation denied) {
    AtomicBoolean allowed = new AtomicBoolean(true);
    doAnswer(
            call -> {
              OperationContext operation = call.getArgument(1);
              if (!allowed.get() && operation.getOperations(call.getArgument(2)).contains(denied)) {
                throw new AuthorizationException("Pipeline is restricted");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(OperationContext.class), any());
    ServiceProgressSubscriber subscriber = subscriber();

    assertTrue(subscriber.apply(event()).isPresent());
    allowed.set(false);
    assertTrue(subscriber.apply(event()).isEmpty());
    allowed.set(true);
    assertTrue(subscriber.apply(event()).isPresent());
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "producerBot"})
  void liveAuthorizationUsesSubscriberAttribution(String producer) {
    ImpersonationContext.setImpersonatedBy("viewerBot");
    ActivePersonaContext.setActivePersona("viewerPersona");
    ServiceProgressSubscriber subscriber = subscriber();
    ImpersonationContext.setImpersonatedBy(producer.isEmpty() ? null : producer);
    ActivePersonaContext.setActivePersona("producerPersona");
    doAnswer(
            call -> {
              RuleEvaluator evaluator = new RuleEvaluator(null, null, null);
              if (evaluator.impersonatedBy("viewerBot")
                  && "viewerPersona".equals(ActivePersonaContext.getActivePersona())) {
                throw new AuthorizationException("Impersonated pipeline reads are restricted");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(OperationContext.class), any());

    assertTrue(subscriber.apply(event()).isEmpty());
    assertEquals(producer.isEmpty() ? null : producer, ImpersonationContext.getImpersonatedBy());
    assertEquals("producerPersona", ActivePersonaContext.getActivePersona());
  }

  @Test
  void ordinarySubscriberDoesNotInheritProducerAttribution() {
    ServiceProgressSubscriber subscriber = subscriber();
    ImpersonationContext.setImpersonatedBy("producerBot");
    ActivePersonaContext.setActivePersona("producerPersona");
    doAnswer(
            call -> {
              if (new RuleEvaluator(null, null, null).isImpersonated()) {
                throw new AuthorizationException("Impersonated pipeline reads are restricted");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(OperationContext.class), any());

    assertTrue(subscriber.apply(event()).isPresent());
    assertEquals("producerBot", ImpersonationContext.getImpersonatedBy());
    assertEquals("producerPersona", ActivePersonaContext.getActivePersona());
  }

  @Test
  void replayUsesCurrentPipelineState() {
    IngestionPipeline cached = pipeline;
    when(repository.getByName(
            isNull(), anyString(), any(Fields.class), any(RelationIncludes.class), anyBoolean()))
        .thenAnswer(
            call -> {
              if (call.getArgument(4, Boolean.class)) {
                return cached;
              }
              throw EntityNotFoundException.byMessage("Pipeline was deleted");
            });

    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @Test
  void rejectsEventsWithoutPipelineIdentity() {
    ServiceProgressSnapshot snapshot = event();
    assertTrue(subscriber().apply(new ServiceProgressSnapshot(null, snapshot.event())).isEmpty());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rejectsEventsFromPreviousPipelineInstance(boolean attachPipeline) {
    ServiceProgressSnapshot previous = event();
    if (attachPipeline) {
      previous.event().withIngestionPipeline(pipeline);
    }
    pipeline = JsonUtils.deepCopy(pipeline, IngestionPipeline.class).withId(UUID.randomUUID());

    assertTrue(subscriber().apply(previous).isEmpty());
  }

  @Test
  void rejectsMissingPipeline() {
    pipeline = null;
    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @Test
  void rejectsPipelineOwnedByDifferentServiceType() {
    pipeline.withService(
        new EntityReference().withId(service.getId()).withType(Entity.DASHBOARD_SERVICE));
    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @Test
  void rejectsPipelineOwnedByDifferentService() {
    pipeline.withService(
        new EntityReference().withId(UUID.randomUUID()).withType(service.getType()));
    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @Test
  void rejectsPipelineWithoutService() {
    pipeline.withService(null);
    assertTrue(subscriber().apply(event()).isEmpty());
  }

  @Test
  void passesAuthorizedProgressWithoutAttachedPipeline() {
    ServiceProgressSnapshot snapshot = event();
    assertEquals(snapshot.event(), subscriber().apply(snapshot).orElseThrow());
  }

  @Test
  void masksACopyForEachSubscriber() {
    pipeline
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DbtPipeline()
                        .withDbtConfigSource(
                            new DbtS3Config()
                                .withDbtSecurityConfig(
                                    new AWSCredentials().withAwsSecretAccessKey("secret-value")))))
        .withOpenMetadataServerConnection(new OpenMetadataConnection());
    SecretsManagerFactory.getSecretsManager().encryptIngestionPipeline(pipeline);
    String stored = JsonUtils.pojoToJson(pipeline);
    ServiceProgressSnapshot snapshot = event();
    snapshot.event().withIngestionPipeline(pipeline);
    when(authorizer.shouldMaskPasswords(caller)).thenReturn(true);
    IngestionPipeline masked = subscriber().apply(snapshot).orElseThrow().getIngestionPipeline();
    assertNotSame(pipeline, masked);
    assertEquals("*********", password(masked));
    assertNull(masked.getOpenMetadataServerConnection());
    assertEquals(stored, JsonUtils.pojoToJson(snapshot.event().getIngestionPipeline()));

    when(authorizer.shouldMaskPasswords(caller)).thenReturn(false);
    IngestionPipeline unmasked = subscriber().apply(snapshot).orElseThrow().getIngestionPipeline();
    assertEquals("secret-value", password(unmasked));
    assertEquals(stored, JsonUtils.pojoToJson(snapshot.event().getIngestionPipeline()));
  }

  private String password(IngestionPipeline value) {
    DbtPipeline config =
        JsonUtils.convertValue(value.getSourceConfig().getConfig(), DbtPipeline.class);
    DbtS3Config s3 = JsonUtils.convertValue(config.getDbtConfigSource(), DbtS3Config.class);
    return s3.getDbtSecurityConfig().getAwsSecretAccessKey();
  }
}
