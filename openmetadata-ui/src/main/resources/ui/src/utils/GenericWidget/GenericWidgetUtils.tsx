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
import classNames from 'classnames';
import { lazy, type ComponentType } from 'react';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import type { DomainLabelProps } from '../../components/common/DomainLabel/DomainLabel.interface';
import type { PreviewerProp } from '../../components/common/RichTextEditor/RichTextEditor.interface';
import type { EntityUnion } from '../../components/Explore/ExplorePage.interface';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import {
  DUMMY_OWNER_LIST,
  DUMMY_TAGS_LIST,
  WIDGET_CUSTOM_PROPERTIES,
} from '../../constants/CustomizeWidgets.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { TagSource } from '../../generated/tests/testCase';
import type { EntityReference } from '../../generated/tests/testCase';
import domainClassBase from '../Domain/DomainClassBase';
import { renderReferenceElement } from '../GlossaryUtils';
import tableClassBase from '../TableClassBase';

const PropertyValue = withSuspenseFallback(
  lazy(() =>
    import('../../components/common/CustomPropertyTable/PropertyValue').then(
      (m) => ({ default: m.PropertyValue })
    )
  )
) as ComponentType<Record<string, unknown>>;

const DomainLabel = withSuspenseFallback(
  lazy(() =>
    import('../../components/common/DomainLabel/DomainLabel.component').then(
      (m) => ({ default: m.DomainLabel })
    )
  )
) as ComponentType<DomainLabelProps>;

const RichTextEditorPreviewerV1 = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/common/RichTextEditor/RichTextEditorPreviewerV1'
      )
  )
) as ComponentType<PreviewerProp>;

const TagButton = withSuspenseFallback(
  lazy(() => import('../../components/common/TagButton/TagButton.component'))
) as ComponentType<Record<string, unknown>>;

const ContainerWidget = withSuspenseFallback(
  lazy(() =>
    import('../../components/Container/ContainerWidget/ContainerWidget').then(
      (m) => ({ default: m.ContainerWidget })
    )
  )
);

const StoredProcedureCodeCard = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Database/StoredProcedureCodeCard/StoredProcedureCodeCard'
    ).then((m) => ({ default: m.StoredProcedureCodeCard }))
  )
);

const APIEndpointSchema = withSuspenseFallback(
  lazy(
    () =>
      import('../../components/APIEndpoint/APIEndpointSchema/APIEndpointSchema')
  )
);

const OwnerLabel = withSuspenseFallback(
  lazy(() =>
    import('../../components/common/OwnerLabel/OwnerLabel.component').then(
      (m) => ({ default: m.OwnerLabel })
    )
  )
);

const ContainerChildren = withSuspenseFallback(
  lazy(
    () =>
      import('../../components/Container/ContainerChildren/ContainerChildren')
  )
);

const DashboardChartTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Dashboard/DashboardChartTable/DashboardChartTable'
    ).then((m) => ({ default: m.DashboardChartTable }))
  )
);

const ModelTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Dashboard/DataModel/DataModels/ModelTab/ModelTab.component'
      )
  )
);

const DatabaseSchemaTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable'
    ).then((m) => ({ default: m.DatabaseSchemaTable }))
  )
);

const SchemaTable = withSuspenseFallback(
  lazy(
    () => import('../../components/Database/SchemaTable/SchemaTable.component')
  )
);

const MarketplaceDataProductsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/DataMarketplace/MarketplaceDataProductsWidget/MarketplaceDataProductsWidget.component'
      )
  )
);

const MarketplaceDomainsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/DataMarketplace/MarketplaceDomainsWidget/MarketplaceDomainsWidget.component'
      )
  )
);

const DataProductsContainer = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component'
      )
  )
);

const GlossaryTermTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTermTab/GlossaryTermTab.component'
      )
  )
);

const MlModelFeaturesList = withSuspenseFallback(
  lazy(
    () => import('../../components/MlModel/MlModelDetail/MlModelFeaturesList')
  )
);

const PipelineTaskTab = withSuspenseFallback(
  lazy(() =>
    import('../../components/Pipeline/PipelineTaskTab/PipelineTaskTab').then(
      (m) => ({ default: m.PipelineTaskTab })
    )
  )
);

const TagsViewer = withSuspenseFallback(
  lazy(() => import('../../components/Tag/TagsViewer/TagsViewer'))
);

const TopicSchemaFields = withSuspenseFallback(
  lazy(() => import('../../components/Topic/TopicSchema/TopicSchema'))
);

const APIEndpointsTab = withSuspenseFallback(
  lazy(() => import('../../pages/APICollectionPage/APIEndpointsTab'))
);

const SearchIndexFieldsTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../pages/SearchIndexDetailsPage/SearchIndexFieldsTab/SearchIndexFieldsTab'
      )
  )
);

const SchemaTablesTab = withSuspenseFallback(
  lazy(() => import('../../pages/DatabaseSchemaPage/SchemaTablesTab'))
);

const FrequentlyJoinedTables = withSuspenseFallback(
  lazy(() =>
    import(
      '../../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component'
    ).then((m) => ({ default: m.FrequentlyJoinedTables }))
  )
);

const TableConstraints = withSuspenseFallback(
  lazy(
    () =>
      import('../../pages/TableDetailsPageV1/TableConstraints/TableConstraints')
  )
);

const PartitionedKeys = withSuspenseFallback(
  lazy(() =>
    import(
      '../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component'
    ).then((m) => ({ default: m.PartitionedKeys }))
  )
);

export const WIDGET_COMPONENTS = {
  [DetailPageWidgetKeys.GLOSSARY_TERMS]: () => (
    <TagsViewer
      displayType={DisplayType.READ_MORE}
      showNoDataPlaceholder={false}
      tagType={TagSource.Glossary}
      tags={DUMMY_TAGS_LIST}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.RELATED_TERMS]: () => (
    <TagsViewer
      displayType={DisplayType.READ_MORE}
      showNoDataPlaceholder={false}
      tagType={TagSource.Glossary}
      tags={DUMMY_TAGS_LIST}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.SYNONYMS]: () => (
    <TagButton className="glossary-synonym-tag" key="synonym" label="synonym" />
  ),
  [DetailPageWidgetKeys.DOMAIN_TYPE]: () =>
    domainClassBase.getDummyData().domainType,
  [DetailPageWidgetKeys.DOMAIN]: () => (
    <DomainLabel
      domains={[
        { type: EntityType.DOMAIN, name: 'Engineering' } as EntityReference,
      ]}
      entityFqn="Engineering"
      entityId="123"
      entityType={EntityType.DOMAIN}
      hasPermission={false}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.REFERENCES]: () => {
    const references = [
      { name: 'Google', endpoint: 'https://www.google.com' },
      { name: 'Collate', endpoint: 'https://www.getcollate.io' },
    ];

    return references.map((term) => renderReferenceElement(term));
  },
  [DetailPageWidgetKeys.TAGS]: () => (
    <TagsViewer
      displayType={DisplayType.READ_MORE}
      showNoDataPlaceholder={false}
      tagType={TagSource.Classification}
      tags={DUMMY_TAGS_LIST}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.OWNER]: () => (
    <OwnerLabel hasPermission={false} owners={DUMMY_OWNER_LIST} />
  ),
  [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: () => (
    <div className="flex gap-2 flex-col">
      {WIDGET_CUSTOM_PROPERTIES.map((prop, index) => (
        <div
          className={classNames(' bordered', {
            'top-border-radius': index === 0,
            'bottom-border-radius':
              index === WIDGET_CUSTOM_PROPERTIES.length - 1,
          })}
          key={prop.name}>
          <PropertyValue
            extension={{
              [prop.name]: prop.value,
            }}
            hasEditPermissions={false}
            key={prop.name}
            property={{
              name: prop.name,
              propertyType: prop.propertyType,
              description: prop.description,
              displayName: prop.displayName,
            }}
            onExtensionUpdate={() => Promise.resolve()}
          />
        </div>
      ))}
    </div>
  ),

  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: () => (
    <OwnerLabel hasPermission={false} owners={DUMMY_OWNER_LIST} />
  ),
  [DetailPageWidgetKeys.DESCRIPTION]: (data?: EntityUnion) => (
    <RichTextEditorPreviewerV1 markdown={data?.description ?? ''} />
  ),
  [DetailPageWidgetKeys.TABLE_SCHEMA]: () => <SchemaTable />,
  [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]: () => (
    <FrequentlyJoinedTables renderAsExpandableCard={false} />
  ),
  [DetailPageWidgetKeys.DATA_PRODUCTS]: () => (
    <DataProductsContainer
      dataProducts={tableClassBase.getDummyData().dataProducts ?? []}
      hasPermission={false}
      showHeader={false}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.TERMS_TABLE]: () => (
    <GlossaryTermTab isGlossary />
  ),
  [DetailPageWidgetKeys.TABLE_CONSTRAINTS]: () => (
    <TableConstraints renderAsExpandableCard={false} />
  ),
  [DetailPageWidgetKeys.TOPIC_SCHEMA]: () => <TopicSchemaFields />,
  [DetailPageWidgetKeys.DATA_MODEL]: () => <ModelTab />,
  [DetailPageWidgetKeys.CONTAINER_CHILDREN]: () => (
    <ContainerChildren isReadOnly />
  ),
  [DetailPageWidgetKeys.CHARTS_TABLE]: () => (
    <DashboardChartTable isCustomizationPage />
  ),
  [DetailPageWidgetKeys.EXPERTS]: () => (
    <OwnerLabel
      hasPermission={false}
      owners={domainClassBase.getDummyData().experts ?? []}
    />
  ),
  [DetailPageWidgetKeys.API_ENDPOINTS]: () => (
    <APIEndpointsTab isCustomizationPage />
  ),
  [DetailPageWidgetKeys.API_SCHEMA]: () => <APIEndpointSchema />,
  [DetailPageWidgetKeys.CONTAINER_SCHEMA]: () => <ContainerWidget />,
  [DetailPageWidgetKeys.DATABASE_SCHEMA]: () => (
    <DatabaseSchemaTable isCustomizationPage />
  ),
  [DetailPageWidgetKeys.TABLES]: () => <SchemaTablesTab isCustomizationPage />,
  [DetailPageWidgetKeys.ML_MODEL_FEATURES]: () => <MlModelFeaturesList />,
  [DetailPageWidgetKeys.PIPELINE_TASKS]: () => <PipelineTaskTab />,
  [DetailPageWidgetKeys.SEARCH_INDEX_FIELDS]: () => <SearchIndexFieldsTab />,
  [DetailPageWidgetKeys.STORED_PROCEDURE_CODE]: () => (
    <StoredProcedureCodeCard />
  ),
  [DetailPageWidgetKeys.PARTITIONED_KEYS]: () => (
    <PartitionedKeys renderAsExpandableCard={false} />
  ),
  [DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS]: () => (
    <MarketplaceDataProductsWidget
      widgetKey={DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS}
    />
  ),
  [DetailPageWidgetKeys.MARKETPLACE_DOMAINS]: () => (
    <MarketplaceDomainsWidget
      widgetKey={DetailPageWidgetKeys.MARKETPLACE_DOMAINS}
    />
  ),
} as const;
