/*
 *  Copyright 2023 Collate.
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

import ApiEndpointsImg from '../../assets/img/widgets/api-endpoints.png';
import ApiSchemaImg from '../../assets/img/widgets/api-schema.png';
import ContainerChildrenImg from '../../assets/img/widgets/container-children.png';
import ContainerSchemaImg from '../../assets/img/widgets/container-schema.png';
import CustomPropertyImg from '../../assets/img/widgets/custom_properties.png';
import ChartsTableImg from '../../assets/img/widgets/dashboard-charts.png';
import DataModelImg from '../../assets/img/widgets/dashboard-data-model.png';
import DataProductImg from '../../assets/img/widgets/data-products.png';
import DatabaseSchemaImg from '../../assets/img/widgets/database-schema-table.png';
import DescriptionLargeImg from '../../assets/img/widgets/description-large.png';
import DescriptionImg from '../../assets/img/widgets/description.png';
import DomainTypeImg from '../../assets/img/widgets/domain-type.png';
import DomainImg from '../../assets/img/widgets/domain.png';
import ExpertsImg from '../../assets/img/widgets/experts.png';
import FrequentlyJoinedTablesImg from '../../assets/img/widgets/frequently-joined-tables.png';
import GlossaryTermImg from '../../assets/img/widgets/glossary-terms.png';
import MlModelFeaturesImg from '../../assets/img/widgets/ml-features.png';
import OwnersImg from '../../assets/img/widgets/owners.png';
import PipelineTasksImg from '../../assets/img/widgets/pipeline-tasks.png';
import ReferencesImg from '../../assets/img/widgets/references.png';
import RelatedMetricsImg from '../../assets/img/widgets/related-metrics.png';
import RelatedTermsImg from '../../assets/img/widgets/related-term.png';
import ReviewersImg from '../../assets/img/widgets/reviewers.png';
import SchemaTablesImg from '../../assets/img/widgets/schema-tables.png';
import SearchIndexFieldsImg from '../../assets/img/widgets/search-index-fields.png';
import StoredProcedureCodeImg from '../../assets/img/widgets/stored-procedure-code.png';
import SynonymsImg from '../../assets/img/widgets/synonyms.png';
import TableConstraints from '../../assets/img/widgets/table-constraints.png';
import TablesSchemaImg from '../../assets/img/widgets/tables-schema.png';
import TagsImg from '../../assets/img/widgets/tags.png';
import TermsImg from '../../assets/img/widgets/Terms.png';
import TopicSchemaImg from '../../assets/img/widgets/topic-schema.png';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
  WidgetWidths,
} from '../../enums/CustomizeDetailPage.enum';

class CustomizeDetailPageClassBase {
  public getGlossaryWidgetImageFromKey(
    widgetKey: string,
    size?: number
  ): string {
    switch (widgetKey) {
      case GlossaryTermDetailPageWidgetKeys.DESCRIPTION:
        if (size === WidgetWidths.large) {
          return DescriptionLargeImg;
        }

        return DescriptionImg;
      case GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return CustomPropertyImg;
      case GlossaryTermDetailPageWidgetKeys.DOMAIN:
        return DomainImg;
      case GlossaryTermDetailPageWidgetKeys.OWNER:
        return OwnersImg;
      case GlossaryTermDetailPageWidgetKeys.REFERENCES:
        return ReferencesImg;
      case GlossaryTermDetailPageWidgetKeys.RELATED_TERMS:
        return RelatedTermsImg;
      case GlossaryTermDetailPageWidgetKeys.REVIEWER:
        return ReviewersImg;
      case GlossaryTermDetailPageWidgetKeys.SYNONYMS:
        return SynonymsImg;
      case GlossaryTermDetailPageWidgetKeys.TERMS_TABLE:
        return TermsImg;
      case GlossaryTermDetailPageWidgetKeys.TAGS:
        return TagsImg;
      default:
        return '';
    }
  }

  public getDetailPageWidgetImageFromKey(
    widgetKey: string,
    size?: number
  ): string {
    switch (widgetKey) {
      case DetailPageWidgetKeys.DESCRIPTION:
        if (size === WidgetWidths.large) {
          return DescriptionLargeImg;
        }

        return DescriptionImg;
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return CustomPropertyImg;
      case DetailPageWidgetKeys.OWNERS:
        return OwnersImg;
      case DetailPageWidgetKeys.EXPERTS:
        return ExpertsImg;
      case DetailPageWidgetKeys.TAGS:
        return TagsImg;
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return DataProductImg;
      case DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES:
        return FrequentlyJoinedTablesImg;
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return GlossaryTermImg;
      case DetailPageWidgetKeys.TABLE_SCHEMA:
        return TablesSchemaImg;
      case DetailPageWidgetKeys.TABLE_CONSTRAINTS:
        return TableConstraints;
      case DetailPageWidgetKeys.API_ENDPOINTS:
        return ApiEndpointsImg;
      case DetailPageWidgetKeys.API_SCHEMA:
        return ApiSchemaImg;
      case DetailPageWidgetKeys.CONTAINER_SCHEMA:
        return ContainerSchemaImg;
      case DetailPageWidgetKeys.CONTAINER_CHILDREN:
        return ContainerChildrenImg;
      case DetailPageWidgetKeys.CHARTS_TABLE:
        return ChartsTableImg;
      case DetailPageWidgetKeys.DATA_MODEL:
        return DataModelImg;
      case DetailPageWidgetKeys.DATABASE_SCHEMA:
        return DatabaseSchemaImg;
      case DetailPageWidgetKeys.TABLES:
        return SchemaTablesImg;
      case DetailPageWidgetKeys.RELATED_METRICS:
        return RelatedMetricsImg;
      case DetailPageWidgetKeys.ML_MODEL_FEATURES:
        return MlModelFeaturesImg;
      case DetailPageWidgetKeys.PIPELINE_TASKS:
        return PipelineTasksImg;
      case DetailPageWidgetKeys.SEARCH_INDEX_FIELDS:
        return SearchIndexFieldsImg;
      case DetailPageWidgetKeys.STORED_PROCEDURE_CODE:
        return StoredProcedureCodeImg;
      case DetailPageWidgetKeys.TOPIC_SCHEMA:
        return TopicSchemaImg;
      case DetailPageWidgetKeys.DOMAIN_TYPE:
        return DomainTypeImg;
      default:
        return '';
    }
  }
}

const customizeDetailPageClassBase = new CustomizeDetailPageClassBase();

export default customizeDetailPageClassBase;
export { CustomizeDetailPageClassBase };
