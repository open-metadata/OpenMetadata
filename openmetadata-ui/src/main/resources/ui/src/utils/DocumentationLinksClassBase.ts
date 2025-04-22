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

class DocumentationLinksClassBase {
  docsBaseURL = 'https://docs.open-metadata.org/';

  protected updateDocsBaseURL(url: string) {
    this.docsBaseURL = url;
  }

  public getDocsBaseURL() {
    return this.docsBaseURL;
  }

  public getDocsURLS() {
    return {
      WORKFLOWS_PROFILER_DOCS: `${this.docsBaseURL}how-to-guides/data-quality-observability/profiler/workflow`,
      GLOSSARIES_DOCS: `${this.docsBaseURL}main-concepts/metadata-standard/schemas/entity/data/glossary`,
      CONNECTORS_DOCS: `${this.docsBaseURL}connectors`,
      WORKFLOWS_METADATA_DOCS: `${this.docsBaseURL}connectors/ingestion/workflows/metadata`,
      INGESTION_FRAMEWORK_DEPLOYMENT_DOCS: `${this.docsBaseURL}deployment/ingestion`,
      BOTS_DOCS: `${this.docsBaseURL}main-concepts/metadata-standard/schemas/entity/bot`,
      TEAMS_DOCS: `${this.docsBaseURL}how-to-guides/admin-guide/teams-and-users/team-structure-openmetadata`,
      ADD_CUSTOM_PROPERTIES_DOCS: `${this.docsBaseURL}how-to-guides/guide-for-data-users/custom`,
      ROLE_DOCS: `${this.docsBaseURL}main-concepts/metadata-standard/schemas/entity/teams/role`,
      DATA_INSIGHT_DOCS: `${this.docsBaseURL}how-to-guides/data-insights`,
      INGESTION_DOCS: `${this.docsBaseURL}connectors/ingestion/workflows`,
      USAGE_DOCS: `${this.docsBaseURL}connectors/ingestion/workflows/usage`,
      LOCAL_DEPLOYMENT: `${this.docsBaseURL}quick-start/local-docker-deployment`,
      DATA_INSIGHTS_PIPELINE_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/ingestion`,
      ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS: `${this.docsBaseURL}main-concepts/metadata-standard/schemas/entity/services/connections/metadata/metadataesconnection`,
      ALERTS_DOCS: `${this.docsBaseURL}how-to-guides/admin-guide/alerts`,
      TAGS_DOCS: `${this.docsBaseURL}main-concepts/metadata-standard/schemas/api/tags`,
      AIRFLOW_DOCS: `${this.docsBaseURL}deployment/ingestion/external/airflow`,
      FOLLOW_DATA_ASSET: `${this.docsBaseURL}how-to-guides/guide-for-data-users/follow-data-asset`,
      RECENTLY_VIEWED: `${this.docsBaseURL}how-to-guides/data-discovery/discover`,
      DATA_QUALITY_PROFILER_DOCS: `${this.docsBaseURL}how-to-guides/data-quality-observability`,
      DATA_QUALITY_PROFILER_WORKFLOW_DOCS: `${this.docsBaseURL}how-to-guides/data-quality-observability/profiler/workflow`,
      CUSTOM_PROPERTIES_DOCS: `${this.docsBaseURL}how-to-guides/guide-for-data-users/custom`,
      DATA_DISCOVERY_DOCS: `${this.docsBaseURL}how-to-guides/data-discovery`,
      HOW_TO_GUIDE_DOCS: `${this.docsBaseURL}how-to-guides`,
      AUTO_CLASSIFICATION_DOCS: `${this.docsBaseURL}how-to-guides/data-governance/classification/auto`,
      OMD_SLACK_LINK:
        'https://join.slack.com/t/openmetadata/shared_invite/zt-1r1kv175f-9qM5eTB39MF6U2DBhZhWow',
      OMD_REPOSITORY_LINK: 'https://star-us.open-metadata.org/',
      TOTAL_DATA_ASSETS_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#total-data-assets`,
      DESCRIPTION_COVERAGE_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#description-coverage`,
      OWNERSHIP_COVERAGE_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#ownership-coverage`,
      PII_COVERAGE_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#pii-coverage`,
      PII_DISTRIBUTION_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#pii-distribution`,
      TIER_COVERAGE_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#tier-coverage`,
      TIER_DISTRIBUTION_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#tier-distribution`,
      COLLATE_AI_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#generated-data-with-collate-ai-collate-only`,
      MOST_USED_ASSETS_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#most-used-assets`,
      MOST_EXPENSIVE_QUERIES_WIDGET_DOCS: `${this.docsBaseURL}how-to-guides/data-insights/service-insights#most-expensive-queries`,
    };
  }
}

const documentationLinksClassBase = new DocumentationLinksClassBase();

export default documentationLinksClassBase;
export { DocumentationLinksClassBase };
