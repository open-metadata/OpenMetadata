export const mockIngestionWorkFlow = {
  data: {
    data: [
      {
        id: '3dae41fd-0469-483b-9d48-622577f2e075',
        name: 'test1',
        displayName: 'Test1',
        owner: {
          id: '360d5fd9-ba6b-4205-a92c-8eb98286c1c5',
          type: 'user',
          name: 'Aaron Johnson',
          href: 'http://localhost:8585/api/v1/users/360d5fd9-ba6b-4205-a92c-8eb98286c1c5',
        },
        fullyQualifiedName: 'bigquery.test1',
        ingestionType: 'bigquery',
        tags: [],
        forceDeploy: true,
        pauseWorkflow: false,
        concurrency: 1,
        startDate: '2021-11-24',
        endDate: '2022-11-25',
        workflowTimezone: 'UTC',
        retries: 1,
        retryDelay: 300,
        workflowCatchup: false,
        scheduleInterval: '0 12 * * *',
        workflowTimeout: 60,
        connectorConfig: {
          username: 'test',
          password: 'test',
          host: 'http://localhost:3000/ingestion',
          database: 'mysql',
          includeViews: true,
          enableDataProfiler: false,
          includeFilterPattern: [],
          excludeFilterPattern: [],
        },
        ingestionStatuses: [],
        service: {
          id: 'e7e34bc7-fc12-40d6-9478-a6297cdefe7a',
          type: 'databaseService',
          name: 'bigquery',
          description: 'BigQuery service used for shopify data',
          href: 'http://localhost:8585/api/v1/services/databaseServices/e7e34bc7-fc12-40d6-9478-a6297cdefe7a',
        },
        href: 'http://localhost:8585/api/ingestion/3dae41fd-0469-483b-9d48-622577f2e075',
        version: 0.1,
        updatedAt: 1637736180218,
        updatedBy: 'anonymous',
      },
    ],
    paging: {
      total: 1,
    },
  },
};

export const mockService = {
  data: {
    data: [
      {
        id: 'e7e34bc7-fc12-40d6-9478-a6297cdefe7a',
        name: 'bigquery',
        serviceType: 'BigQuery',
        description: 'BigQuery service used for shopify data',
        version: 0.1,
        updatedAt: 1637734235276,
        updatedBy: 'anonymous',
        href: 'http://localhost:8585/api/v1/services/databaseServices/e7e34bc7-fc12-40d6-9478-a6297cdefe7a',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
    ],
    paging: {
      total: 1,
    },
  },
};
