/*
 *  Copyright 2025 Collate.
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
import { DocumentationLinksClassBase } from './DocumentationLinksClassBase';

describe('DocumentationLinksClassBase', () => {
  let documentationLinksClassBase: DocumentationLinksClassBase;

  beforeEach(() => {
    documentationLinksClassBase = new DocumentationLinksClassBase();
  });

  it('should return the default docsBaseURL', () => {
    expect(documentationLinksClassBase.getDocsBaseURL()).toBe(
      'https://docs.open-metadata.org/'
    );
  });

  it('should return the correct documentation URLs', () => {
    const docsURLs = documentationLinksClassBase.getDocsURLS();

    expect(docsURLs.WORKFLOWS_PROFILER_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow'
    );
    expect(docsURLs.GLOSSARIES_DOCS).toBe(
      'https://docs.open-metadata.org/main-concepts/metadata-standard/schemas/entity/data/glossary'
    );
    expect(docsURLs.CONNECTORS_DOCS).toBe(
      'https://docs.open-metadata.org/connectors'
    );
    expect(docsURLs.WORKFLOWS_METADATA_DOCS).toBe(
      'https://docs.open-metadata.org/connectors/ingestion/workflows/metadata'
    );
    expect(docsURLs.INGESTION_FRAMEWORK_DEPLOYMENT_DOCS).toBe(
      'https://docs.open-metadata.org/deployment/ingestion'
    );
    expect(docsURLs.BOTS_DOCS).toBe(
      'https://docs.open-metadata.org/main-concepts/metadata-standard/schemas/entity/bot'
    );
    expect(docsURLs.TEAMS_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/admin-guide/teams-and-users/team-structure-openmetadata'
    );
    expect(docsURLs.ADD_CUSTOM_PROPERTIES_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/guide-for-data-users/custom'
    );
    expect(docsURLs.ROLE_DOCS).toBe(
      'https://docs.open-metadata.org/main-concepts/metadata-standard/schemas/entity/teams/role'
    );
    expect(docsURLs.DATA_INSIGHT_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-insights'
    );
    expect(docsURLs.INGESTION_DOCS).toBe(
      'https://docs.open-metadata.org/connectors/ingestion/workflows'
    );
    expect(docsURLs.USAGE_DOCS).toBe(
      'https://docs.open-metadata.org/connectors/ingestion/workflows/usage'
    );
    expect(docsURLs.LOCAL_DEPLOYMENT).toBe(
      'https://docs.open-metadata.org/quick-start/local-docker-deployment'
    );
    expect(docsURLs.DATA_INSIGHTS_PIPELINE_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-insights/ingestion'
    );
    expect(docsURLs.ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS).toBe(
      'https://docs.open-metadata.org/main-concepts/metadata-standard/schemas/entity/services/connections/metadata/metadataesconnection'
    );
    expect(docsURLs.ALERTS_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/admin-guide/alerts'
    );
    expect(docsURLs.TAGS_DOCS).toBe(
      'https://docs.open-metadata.org/main-concepts/metadata-standard/schemas/api/tags'
    );
    expect(docsURLs.AIRFLOW_DOCS).toBe(
      'https://docs.open-metadata.org/deployment/ingestion/external/airflow'
    );
    expect(docsURLs.FOLLOW_DATA_ASSET).toBe(
      'https://docs.open-metadata.org/how-to-guides/guide-for-data-users/follow-data-asset'
    );
    expect(docsURLs.RECENTLY_VIEWED).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-discovery/discover'
    );
    expect(docsURLs.DATA_QUALITY_PROFILER_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-quality-observability'
    );
    expect(docsURLs.CUSTOM_PROPERTIES_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/guide-for-data-users/custom'
    );
    expect(docsURLs.DATA_DISCOVERY_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides/data-discovery'
    );
    expect(docsURLs.HOW_TO_GUIDE_DOCS).toBe(
      'https://docs.open-metadata.org/how-to-guides'
    );
    expect(docsURLs.OMD_SLACK_LINK).toBe(
      'https://join.slack.com/t/openmetadata/shared_invite/zt-1r1kv175f-9qM5eTB39MF6U2DBhZhWow'
    );
    expect(docsURLs.OMD_REPOSITORY_LINK).toBe(
      'https://star-us.open-metadata.org/'
    );
  });

  it('should return updated documentation URLs after changing the base URL', () => {
    // Use a private method to update the base URL for testing purposes
    const newURL = 'https://new-docs-url.org/';
    (documentationLinksClassBase as any).updateDocsBaseURL(newURL);
    const docsURLs = documentationLinksClassBase.getDocsURLS();

    expect(docsURLs.WORKFLOWS_PROFILER_DOCS).toBe(
      `${newURL}how-to-guides/data-quality-observability/profiler/workflow`
    );
    expect(docsURLs.GLOSSARIES_DOCS).toBe(
      `${newURL}main-concepts/metadata-standard/schemas/entity/data/glossary`
    );
    expect(docsURLs.CONNECTORS_DOCS).toBe(`${newURL}connectors`);
    expect(docsURLs.WORKFLOWS_METADATA_DOCS).toBe(
      `${newURL}connectors/ingestion/workflows/metadata`
    );
    expect(docsURLs.INGESTION_FRAMEWORK_DEPLOYMENT_DOCS).toBe(
      `${newURL}deployment/ingestion`
    );
    expect(docsURLs.BOTS_DOCS).toBe(
      `${newURL}main-concepts/metadata-standard/schemas/entity/bot`
    );
    expect(docsURLs.TEAMS_DOCS).toBe(
      `${newURL}how-to-guides/admin-guide/teams-and-users/team-structure-openmetadata`
    );
    expect(docsURLs.ADD_CUSTOM_PROPERTIES_DOCS).toBe(
      `${newURL}how-to-guides/guide-for-data-users/custom`
    );
    expect(docsURLs.ROLE_DOCS).toBe(
      `${newURL}main-concepts/metadata-standard/schemas/entity/teams/role`
    );
    expect(docsURLs.DATA_INSIGHT_DOCS).toBe(
      `${newURL}how-to-guides/data-insights`
    );
    expect(docsURLs.INGESTION_DOCS).toBe(
      `${newURL}connectors/ingestion/workflows`
    );
    expect(docsURLs.USAGE_DOCS).toBe(
      `${newURL}connectors/ingestion/workflows/usage`
    );
    expect(docsURLs.LOCAL_DEPLOYMENT).toBe(
      `${newURL}quick-start/local-docker-deployment`
    );
    expect(docsURLs.DATA_INSIGHTS_PIPELINE_DOCS).toBe(
      `${newURL}how-to-guides/data-insights/ingestion`
    );
    expect(docsURLs.ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS).toBe(
      `${newURL}main-concepts/metadata-standard/schemas/entity/services/connections/metadata/metadataesconnection`
    );
    expect(docsURLs.ALERTS_DOCS).toBe(
      `${newURL}how-to-guides/admin-guide/alerts`
    );
    expect(docsURLs.TAGS_DOCS).toBe(
      `${newURL}main-concepts/metadata-standard/schemas/api/tags`
    );
    expect(docsURLs.AIRFLOW_DOCS).toBe(
      `${newURL}deployment/ingestion/external/airflow`
    );
    expect(docsURLs.FOLLOW_DATA_ASSET).toBe(
      `${newURL}how-to-guides/guide-for-data-users/follow-data-asset`
    );
    expect(docsURLs.RECENTLY_VIEWED).toBe(
      `${newURL}how-to-guides/data-discovery/discover`
    );
    expect(docsURLs.DATA_QUALITY_PROFILER_DOCS).toBe(
      `${newURL}how-to-guides/data-quality-observability`
    );
    expect(docsURLs.CUSTOM_PROPERTIES_DOCS).toBe(
      `${newURL}how-to-guides/guide-for-data-users/custom`
    );
    expect(docsURLs.DATA_DISCOVERY_DOCS).toBe(
      `${newURL}how-to-guides/data-discovery`
    );
    expect(docsURLs.HOW_TO_GUIDE_DOCS).toBe(`${newURL}how-to-guides`);
    expect(docsURLs.OMD_SLACK_LINK).toBe(
      'https://join.slack.com/t/openmetadata/shared_invite/zt-1r1kv175f-9qM5eTB39MF6U2DBhZhWow'
    );
    expect(docsURLs.OMD_REPOSITORY_LINK).toBe(
      'https://star-us.open-metadata.org/'
    );
  });
});
