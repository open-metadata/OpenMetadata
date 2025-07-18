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

package org.openmetadata.service.cache;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Decorator for CollectionDAO that provides caching capabilities.
 * When cache is enabled, this decorator wraps the EntityRelationshipDAO with
 * CachedEntityRelationshipDAO to provide transparent caching.
 * All other DAO methods are delegated to the original implementation.
 */
@Slf4j
public class CachedCollectionDAO implements CollectionDAO {

  private final CollectionDAO delegate;
  private CachedEntityRelationshipDAO cachedRelationshipDAO;
  private CachedTagUsageDAO cachedTagUsageDAO;

  public CachedCollectionDAO(CollectionDAO delegate) {
    this.delegate = delegate;
    LOG.info("CachedCollectionDAO initialized with caching enabled");
  }

  @Override
  public EntityRelationshipDAO relationshipDAO() {
    if (RelationshipCache.isAvailable()) {
      if (cachedRelationshipDAO == null) {
        cachedRelationshipDAO = new CachedEntityRelationshipDAO(delegate.relationshipDAO());
        LOG.debug("Created CachedEntityRelationshipDAO instance");
      }
      return cachedRelationshipDAO;
    }

    // Fallback to original implementation if cache is not available
    LOG.debug("Cache not available, using original EntityRelationshipDAO");
    return delegate.relationshipDAO();
  }

  @Override
  public TagUsageDAO tagUsageDAO() {
    if (RelationshipCache.isAvailable()) {
      if (cachedTagUsageDAO == null) {
        cachedTagUsageDAO = new CachedTagUsageDAO(delegate.tagUsageDAO());
        LOG.debug("Created CachedTagUsageDAO instance");
      }
      return cachedTagUsageDAO;
    }

    // Fallback to original implementation if cache is not available
    LOG.debug("Cache not available, using original TagUsageDAO");
    return delegate.tagUsageDAO();
  }

  // All other DAO methods are zero-cost delegation abstractions

  @Override
  public DatabaseDAO databaseDAO() {
    return delegate.databaseDAO();
  }

  @Override
  public DatabaseSchemaDAO databaseSchemaDAO() {
    return delegate.databaseSchemaDAO();
  }

  @Override
  public TableDAO tableDAO() {
    return delegate.tableDAO();
  }

  @Override
  public StoredProcedureDAO storedProcedureDAO() {
    return delegate.storedProcedureDAO();
  }

  @Override
  public UserDAO userDAO() {
    return delegate.userDAO();
  }

  @Override
  public TeamDAO teamDAO() {
    return delegate.teamDAO();
  }

  @Override
  public RoleDAO roleDAO() {
    return delegate.roleDAO();
  }

  @Override
  public PolicyDAO policyDAO() {
    return delegate.policyDAO();
  }

  @Override
  public BotDAO botDAO() {
    return delegate.botDAO();
  }

  @Override
  public TokenDAO getTokenDAO() {
    return delegate.getTokenDAO();
  }

  @Override
  public EntityExtensionDAO entityExtensionDAO() {
    return delegate.entityExtensionDAO();
  }

  @Override
  public AppExtensionTimeSeries appExtensionTimeSeriesDao() {
    return delegate.appExtensionTimeSeriesDao();
  }

  @Override
  public AppsDataStore appStoreDAO() {
    return delegate.appStoreDAO();
  }

  @Override
  public EntityExtensionTimeSeriesDAO entityExtensionTimeSeriesDao() {
    return delegate.entityExtensionTimeSeriesDao();
  }

  @Override
  public ReportDataTimeSeriesDAO reportDataTimeSeriesDao() {
    return delegate.reportDataTimeSeriesDao();
  }

  @Override
  public ProfilerDataTimeSeriesDAO profilerDataTimeSeriesDao() {
    return delegate.profilerDataTimeSeriesDao();
  }

  @Override
  public DataQualityDataTimeSeriesDAO dataQualityDataTimeSeriesDao() {
    return delegate.dataQualityDataTimeSeriesDao();
  }

  @Override
  public TestCaseResolutionStatusTimeSeriesDAO testCaseResolutionStatusTimeSeriesDao() {
    return delegate.testCaseResolutionStatusTimeSeriesDao();
  }

  @Override
  public QueryCostTimeSeriesDAO queryCostRecordTimeSeriesDAO() {
    return delegate.queryCostRecordTimeSeriesDAO();
  }

  @Override
  public TestCaseResultTimeSeriesDAO testCaseResultTimeSeriesDao() {
    return delegate.testCaseResultTimeSeriesDao();
  }

  @Override
  public PersonaDAO personaDAO() {
    return delegate.personaDAO();
  }

  @Override
  public TagDAO tagDAO() {
    return delegate.tagDAO();
  }

  @Override
  public ClassificationDAO classificationDAO() {
    return delegate.classificationDAO();
  }

  @Override
  public QueryDAO queryDAO() {
    return delegate.queryDAO();
  }

  @Override
  public UsageDAO usageDAO() {
    return delegate.usageDAO();
  }

  @Override
  public TypeEntityDAO typeEntityDAO() {
    return delegate.typeEntityDAO();
  }

  @Override
  public FieldRelationshipDAO fieldRelationshipDAO() {
    return delegate.fieldRelationshipDAO();
  }

  @Override
  public MetricDAO metricDAO() {
    return delegate.metricDAO();
  }

  @Override
  public ChartDAO chartDAO() {
    return delegate.chartDAO();
  }

  @Override
  public ApplicationDAO applicationDAO() {
    return delegate.applicationDAO();
  }

  @Override
  public ApplicationMarketPlaceDAO applicationMarketPlaceDAO() {
    return delegate.applicationMarketPlaceDAO();
  }

  @Override
  public PipelineDAO pipelineDAO() {
    return delegate.pipelineDAO();
  }

  @Override
  public DashboardDAO dashboardDAO() {
    return delegate.dashboardDAO();
  }

  @Override
  public ReportDAO reportDAO() {
    return delegate.reportDAO();
  }

  @Override
  public TopicDAO topicDAO() {
    return delegate.topicDAO();
  }

  @Override
  public MlModelDAO mlModelDAO() {
    return delegate.mlModelDAO();
  }

  @Override
  public SearchIndexDAO searchIndexDAO() {
    return delegate.searchIndexDAO();
  }

  @Override
  public GlossaryDAO glossaryDAO() {
    return delegate.glossaryDAO();
  }

  @Override
  public GlossaryTermDAO glossaryTermDAO() {
    return delegate.glossaryTermDAO();
  }

  @Override
  public DomainDAO domainDAO() {
    return delegate.domainDAO();
  }

  @Override
  public DataProductDAO dataProductDAO() {
    return delegate.dataProductDAO();
  }

  @Override
  public DataContractDAO dataContractDAO() {
    return delegate.dataContractDAO();
  }

  @Override
  public EventSubscriptionDAO eventSubscriptionDAO() {
    return delegate.eventSubscriptionDAO();
  }

  @Override
  public IngestionPipelineDAO ingestionPipelineDAO() {
    return delegate.ingestionPipelineDAO();
  }

  @Override
  public DatabaseServiceDAO dbServiceDAO() {
    return delegate.dbServiceDAO();
  }

  @Override
  public MetadataServiceDAO metadataServiceDAO() {
    return delegate.metadataServiceDAO();
  }

  @Override
  public PipelineServiceDAO pipelineServiceDAO() {
    return delegate.pipelineServiceDAO();
  }

  @Override
  public MlModelServiceDAO mlModelServiceDAO() {
    return delegate.mlModelServiceDAO();
  }

  @Override
  public DashboardServiceDAO dashboardServiceDAO() {
    return delegate.dashboardServiceDAO();
  }

  @Override
  public MessagingServiceDAO messagingServiceDAO() {
    return delegate.messagingServiceDAO();
  }

  @Override
  public StorageServiceDAO storageServiceDAO() {
    return delegate.storageServiceDAO();
  }

  @Override
  public SearchServiceDAO searchServiceDAO() {
    return delegate.searchServiceDAO();
  }

  @Override
  public SecurityServiceDAO securityServiceDAO() {
    return delegate.securityServiceDAO();
  }

  @Override
  public ApiServiceDAO apiServiceDAO() {
    return delegate.apiServiceDAO();
  }



  @Override
  public ContainerDAO containerDAO() {
    return delegate.containerDAO();
  }

  @Override
  public FeedDAO feedDAO() {
    return delegate.feedDAO();
  }

  @Override
  public ChangeEventDAO changeEventDAO() {
    return delegate.changeEventDAO();
  }

  @Override
  public TestDefinitionDAO testDefinitionDAO() {
    return delegate.testDefinitionDAO();
  }

  @Override
  public TestConnectionDefinitionDAO testConnectionDefinitionDAO() {
    return delegate.testConnectionDefinitionDAO();
  }

  @Override
  public TestSuiteDAO testSuiteDAO() {
    return delegate.testSuiteDAO();
  }

  @Override
  public TestCaseDAO testCaseDAO() {
    return delegate.testCaseDAO();
  }

  @Override
  public WebAnalyticEventDAO webAnalyticEventDAO() {
    return delegate.webAnalyticEventDAO();
  }

  @Override
  public DataInsightCustomChartDAO dataInsightCustomChartDAO() {
    return delegate.dataInsightCustomChartDAO();
  }

  @Override
  public DataInsightChartDAO dataInsightChartDAO() {
    return delegate.dataInsightChartDAO();
  }

  @Override
  public SystemDAO systemDAO() {
    return delegate.systemDAO();
  }

  @Override
  public KpiDAO kpiDAO() {
    return delegate.kpiDAO();
  }

  @Override
  public WorkflowDAO workflowDAO() {
    return delegate.workflowDAO();
  }

  @Override
  public DataModelDAO dashboardDataModelDAO() {
    return delegate.dashboardDataModelDAO();
  }

  @Override
  public DocStoreDAO docStoreDAO() {
    return delegate.docStoreDAO();
  }

  @Override
  public SuggestionDAO suggestionDAO() {
    return delegate.suggestionDAO();
  }

  @Override
  public APICollectionDAO apiCollectionDAO() {
    return delegate.apiCollectionDAO();
  }

  @Override
  public APIEndpointDAO apiEndpointDAO() {
    return delegate.apiEndpointDAO();
  }

  @Override
  public WorkflowDefinitionDAO workflowDefinitionDAO() {
    return delegate.workflowDefinitionDAO();
  }

  @Override
  public WorkflowInstanceTimeSeriesDAO workflowInstanceTimeSeriesDAO() {
    return delegate.workflowInstanceTimeSeriesDAO();
  }

  @Override
  public WorkflowInstanceStateTimeSeriesDAO workflowInstanceStateTimeSeriesDAO() {
    return delegate.workflowInstanceStateTimeSeriesDAO();
  }

  @Override
  public DriveServiceDAO driveServiceDAO() {
    return delegate.driveServiceDAO();
  }

  @Override
  public DirectoryDAO directoryDAO() {
    return delegate.directoryDAO();
  }

  @Override
  public FileDAO fileDAO() {
    return delegate.fileDAO();
  }

  @Override
  public SpreadsheetDAO spreadsheetDAO() {
    return delegate.spreadsheetDAO();
  }

  @Override
  public WorksheetDAO worksheetDAO() {
    return delegate.worksheetDAO();
  }
}
