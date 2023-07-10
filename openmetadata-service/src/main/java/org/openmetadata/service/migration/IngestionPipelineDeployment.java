package org.openmetadata.service.migration;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.opensearch.ingest.IngestInfo;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
public class IngestionPipelineDeployment {
  private final PipelineServiceClient pipelineServiceClient;
  private final CollectionDAO.IngestionPipelineDAO ingestionPipelineDAO;
  private final IngestionPipelineRepository repository;

  public IngestionPipelineDeployment(Jdbi jdbi, PipelineServiceClient pipelineServiceClient) {
    this.pipelineServiceClient = pipelineServiceClient;
    this.ingestionPipelineDAO = jdbi.onDemand(CollectionDAO.IngestionPipelineDAO.class);
    CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
    this.repository = new IngestionPipelineRepository(collectionDAO);
  }

  public void runIngestionPipelineDeployment() {
    LOG.info("Starting Ingestion Pipeline deployment");


    int limitParam = 100;
    List<IngestionPipeline> entities;
    String after = null;

    try {
      do {
        ResultList<IngestionPipeline> result = repository.listAfter(null, new EntityUtil.Fields(List.of("service")), new ListFilter(Include.NON_DELETED), limitParam, after == null ? "" : after);
        after = result.getPaging().getAfter();
        // Deploy each pipeline to update the shape in the orchestrator
        for (IngestionPipeline ingestionPipeline : result.getData()) {
          ServiceEntityInterface service = Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
          pipelineServiceClient.deployPipeline(ingestionPipeline, service);
        }

      } while (!CommonUtil.nullOrEmpty(after));

    } catch (IOException e) {
      // We don't stop the migration, since this is a "quality of life" step.
      // Worst case scenario, we run the redeployment from the OpenMetadata UI.
      LOG.error("Encountered error redeploying Ingestion Pipelines", e);
    }

  }
}
