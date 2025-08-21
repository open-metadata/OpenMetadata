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
import { EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';

export const PageTypeToEntityTypeMap = {
  [PageType.Topic]: EntityType.TOPIC,
  [PageType.APICollection]: EntityType.API_COLLECTION,
  [PageType.APIEndpoint]: EntityType.API_ENDPOINT,
  [PageType.Container]: EntityType.CONTAINER,
  [PageType.Dashboard]: EntityType.DASHBOARD,
  [PageType.DashboardDataModel]: EntityType.DASHBOARD_DATA_MODEL,
  [PageType.Database]: EntityType.DATABASE,
  [PageType.DatabaseSchema]: EntityType.DATABASE_SCHEMA,
  [PageType.Domain]: EntityType.DOMAIN,
  [PageType.Glossary]: EntityType.GLOSSARY,
  [PageType.GlossaryTerm]: EntityType.GLOSSARY_TERM,
  [PageType.Metric]: EntityType.METRIC,
  [PageType.MlModel]: EntityType.MLMODEL,
  [PageType.Pipeline]: EntityType.PIPELINE,
  [PageType.SearchIndex]: EntityType.SEARCH_INDEX,
  [PageType.StoredProcedure]: EntityType.STORED_PROCEDURE,
  [PageType.Table]: EntityType.TABLE,
  [PageType.LandingPage]: EntityType.ALL,
  [PageType.Chart]: EntityType.CHART,
  [PageType.Directory]: EntityType.DIRECTORY,
};
