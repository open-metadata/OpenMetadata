package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import lombok.SneakyThrows;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

import java.util.List;
import java.util.Set;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

public class RunAppImpl {
    public boolean execute(PipelineServiceClientInterface pipelineServiceClient, String appName, boolean waitForCompletion, long timeoutSeconds) {
        AppRepository appRepository =
                (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

        App app = appRepository.getByName(null, appName, new EntityUtil.Fields(Set.of("bot","pipelines")));
        long startTime = System.currentTimeMillis();
        long timeoutMillis = timeoutSeconds * 1000;

        if (app.getAppType().equals(AppType.Internal)) {
            return runApp(appRepository, app, waitForCompletion, startTime, timeoutMillis);
        } else {
            return runApp(pipelineServiceClient, app, waitForCompletion, startTime, timeoutMillis);
        }
    }

    // Internal App Logic
    @SneakyThrows
    private boolean runApp(AppRepository repository, App app, boolean waitForCompletion, long startTime, long timeoutMillis) {
        ApplicationHandler.getInstance().triggerApplicationOnDemand(app, Entity.getCollectionDAO(), Entity.getSearchRepository());

        if (waitForCompletion) {
            return waitForCompletion(repository, app, startTime, timeoutMillis);
        } else {
            return true;
        }

    }

    private boolean waitForCompletion(AppRepository repository, App app, long startTime, long timeoutMillis) {
        AppRunRecord appRunRecord = null;

        do {
            try {
                if (System.currentTimeMillis() - startTime > timeoutMillis) {
                    return false;
                }
                appRunRecord = repository.getLatestAppRunsAfterStartTime(app, startTime);
            } catch (Exception ignore) {}
        } while (!isRunCompleted(appRunRecord));

        return appRunRecord.getStatus().equals(AppRunRecord.Status.SUCCESS) || appRunRecord.getStatus().equals(AppRunRecord.Status.COMPLETED);
    }

    private boolean isRunCompleted(AppRunRecord appRunRecord) {
        if (appRunRecord == null) {
            return false;
        }
        return !nullOrEmpty(appRunRecord.getExecutionTime());
    }

    // External App Logic
    private boolean runApp(PipelineServiceClientInterface pipelineServiceClient, App app, boolean waitForCompletion, long startTime, long timeoutMillis) {
        EntityReference pipelineRef = app.getPipelines().get(0);

        IngestionPipelineRepository repository =
                (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();

        IngestionPipeline ingestionPipeline = repository.get(null, pipelineRef.getId(), EMPTY_FIELDS);
        ingestionPipeline.setOpenMetadataServerConnection(
                new OpenMetadataConnectionBuilder(config).build());

        ServiceEntityInterface service =
                Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);

        pipelineServiceClient.runPipeline(ingestionPipeline, service);

        if (waitForCompletion) {
            return waitForCompletion(repository, ingestionPipeline, startTime, timeoutMillis);
        } else {
            return true;
        }
    }
    private boolean waitForCompletion(IngestionPipelineRepository repository, IngestionPipeline ingestionPipeline, long startTime, long timeoutMillis) {
        while (true) {
            if (System.currentTimeMillis() - startTime > timeoutMillis) {
                return false;
            }

            List<PipelineStatus> statuses = repository.listPipelineStatus(ingestionPipeline.getFullyQualifiedName(), startTime, startTime + timeoutMillis).getData();

            if (statuses.isEmpty()) {
                continue;
            }

            PipelineStatus status = statuses.get(statuses.size() - 1);
            return !status.getPipelineState().equals(PipelineStatusType.FAILED);
        }
    }
}
