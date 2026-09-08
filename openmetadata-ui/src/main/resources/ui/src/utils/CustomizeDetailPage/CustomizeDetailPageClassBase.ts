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
import KnowledgeArticleImg from '../../assets/img/widgets/context-center-widget.png';
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
import { TAB_LABEL_MAP } from '../../constants/Customize.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
  WidgetWidths,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import i18n from '../i18next/LocalUtil';

const GLOSSARY_WIDGET_IMAGE_MAP: Record<string, string> = {
  [GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES]: CustomPropertyImg,
  [GlossaryTermDetailPageWidgetKeys.DOMAIN]: DomainImg,
  [GlossaryTermDetailPageWidgetKeys.OWNER]: OwnersImg,
  [GlossaryTermDetailPageWidgetKeys.REFERENCES]: ReferencesImg,
  [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: RelatedTermsImg,
  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: ReviewersImg,
  [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: SynonymsImg,
  [GlossaryTermDetailPageWidgetKeys.TERMS_TABLE]: TermsImg,
  [GlossaryTermDetailPageWidgetKeys.TAGS]: TagsImg,
};

const DETAIL_PAGE_WIDGET_IMAGE_MAP: Record<string, string> = {
  [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: CustomPropertyImg,
  [DetailPageWidgetKeys.OWNERS]: OwnersImg,
  [DetailPageWidgetKeys.EXPERTS]: ExpertsImg,
  [DetailPageWidgetKeys.TAGS]: TagsImg,
  [DetailPageWidgetKeys.DATA_PRODUCTS]: DataProductImg,
  [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]: FrequentlyJoinedTablesImg,
  [DetailPageWidgetKeys.GLOSSARY_TERMS]: GlossaryTermImg,
  [DetailPageWidgetKeys.TABLE_SCHEMA]: TablesSchemaImg,
  [DetailPageWidgetKeys.TABLE_CONSTRAINTS]: TableConstraints,
  [DetailPageWidgetKeys.API_ENDPOINTS]: ApiEndpointsImg,
  [DetailPageWidgetKeys.API_SCHEMA]: ApiSchemaImg,
  [DetailPageWidgetKeys.CONTAINER_SCHEMA]: ContainerSchemaImg,
  [DetailPageWidgetKeys.CONTAINER_CHILDREN]: ContainerChildrenImg,
  [DetailPageWidgetKeys.CHARTS_TABLE]: ChartsTableImg,
  [DetailPageWidgetKeys.DATA_MODEL]: DataModelImg,
  [DetailPageWidgetKeys.DATABASE_SCHEMA]: DatabaseSchemaImg,
  [DetailPageWidgetKeys.TABLES]: SchemaTablesImg,
  [DetailPageWidgetKeys.RELATED_METRICS]: RelatedMetricsImg,
  [DetailPageWidgetKeys.ML_MODEL_FEATURES]: MlModelFeaturesImg,
  [DetailPageWidgetKeys.PIPELINE_TASKS]: PipelineTasksImg,
  [DetailPageWidgetKeys.SEARCH_INDEX_FIELDS]: SearchIndexFieldsImg,
  [DetailPageWidgetKeys.STORED_PROCEDURE_CODE]: StoredProcedureCodeImg,
  [DetailPageWidgetKeys.TOPIC_SCHEMA]: TopicSchemaImg,
  [DetailPageWidgetKeys.DOMAIN_TYPE]: DomainTypeImg,
  [DetailPageWidgetKeys.KNOWLEDGE_ARTICLE]: KnowledgeArticleImg,
};

function getDescriptionWidgetImage(size?: number): string {
  return size === WidgetWidths.large ? DescriptionLargeImg : DescriptionImg;
}

class CustomizeDetailPageClassBase {
  public getGlossaryWidgetImageFromKey(
    widgetKey: string,
    size?: number
  ): string {
    if (widgetKey === GlossaryTermDetailPageWidgetKeys.DESCRIPTION) {
      return getDescriptionWidgetImage(size);
    }

    return GLOSSARY_WIDGET_IMAGE_MAP[widgetKey] ?? '';
  }

  public getDetailPageWidgetImageFromKey(
    widgetKey: string,
    size?: number
  ): string {
    if (widgetKey === DetailPageWidgetKeys.DESCRIPTION) {
      return getDescriptionWidgetImage(size);
    }

    return DETAIL_PAGE_WIDGET_IMAGE_MAP[widgetKey] ?? '';
  }

  public getTabLabelFromId(tab: EntityTabs): string {
    const labelKey = TAB_LABEL_MAP[tab];

    return labelKey ? i18n.t(labelKey) : tab;
  }
}

const customizeDetailPageClassBase = new CustomizeDetailPageClassBase();

export default customizeDetailPageClassBase;
export { CustomizeDetailPageClassBase };
