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
import { noop } from 'lodash';
import React from 'react';
import { ExtensionTable } from '../../components/common/CustomPropertyTable/ExtensionTable';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TagButton from '../../components/common/TagButton/TagButton.component';
import ContainerChildren from '../../components/Container/ContainerChildren/ContainerChildren';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DashboardChartTable } from '../../components/Dashboard/DashboardChartTable/DashboardChartTable';
import ModelTab from '../../components/Dashboard/DataModel/DataModels/ModelTab/ModelTab.component';
import SchemaTable from '../../components/Database/SchemaTable/SchemaTable.component';
import DataProductsContainer from '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component';
import GlossaryTermTab from '../../components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import TagsViewer from '../../components/Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import TopicSchemaFields from '../../components/Topic/TopicSchema/TopicSchema';
import {
  DUMMY_OWNER_LIST,
  DUMMY_TAGS_LIST,
} from '../../constants/CustomizeWidgets.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { Container } from '../../generated/entity/data/container';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { EntityReference, TagSource } from '../../generated/tests/testCase';
import { FrequentlyJoinedTables } from '../../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import TableConstraints from '../../pages/TableDetailsPageV1/TableConstraints/TableConstraints';
import containerDetailsClassBase from '../ContainerDetailsClassBase';
import dashboardDataModelClassBase from '../DashboardDataModelClassBase';
import domainClassBase from '../Domain/DomainClassBase';
import { renderReferenceElement } from '../GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../PermissionsUtils';
import tableClassBase from '../TableClassBase';
import topicClassBase from '../TopicClassBase';

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
      domain={
        { type: EntityType.DOMAIN, name: 'Engineering' } as EntityReference
      }
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
    <ExtensionTable
      extension={{
        email: 'customproperty@OpenMetadata.com',
        name: 'OpenMetadata',
      }}
      tableClassName="m-0"
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.REVIEWER]: () => (
    <OwnerLabel hasPermission={false} owners={DUMMY_OWNER_LIST} />
  ),
  [DetailPageWidgetKeys.DESCRIPTION]: () => (
    // eslint-disable-next-line max-len
    <RichTextEditorPreviewerV1 markdown="Glossary related to describing **conceptual** terms related to a Person. These terms are used to label data assets to describe the user data in those assets. Example - a table column can be labeled with `Person.PhoneNumber` tag. The associated `PII` and `PersonalData` tags are automatically applied. This is done to help users producing the data  focus on describing the data without being policy experts. The associated tags take care of applying classification tags automatically." />
  ),
  [DetailPageWidgetKeys.TABLE_SCHEMA]: () => (
    <GenericProvider<Table>
      data={tableClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.TABLE}
      onUpdate={async () => noop()}>
      <SchemaTable />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]: () => (
    <GenericProvider<Table>
      data={tableClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.TABLE}
      onUpdate={async () => noop()}>
      <FrequentlyJoinedTables />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.DATA_PRODUCTS]: () => (
    <DataProductsContainer
      dataProducts={tableClassBase.getDummyData().dataProducts ?? []}
      hasPermission={false}
      showHeader={false}
    />
  ),
  [GlossaryTermDetailPageWidgetKeys.TERMS_TABLE]: () => (
    <GlossaryTermTab
      isGlossary
      permissions={DEFAULT_ENTITY_PERMISSION}
      refreshGlossaryTerms={noop}
      termsLoading={false}
      onAddGlossaryTerm={noop}
      onEditGlossaryTerm={noop}
    />
  ),
  [DetailPageWidgetKeys.TABLE_CONSTRAINTS]: () => (
    <GenericProvider<Table>
      data={tableClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.TABLE}
      onUpdate={async () => noop()}>
      <TableConstraints />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.TOPIC_SCHEMA]: () => (
    <GenericProvider<Topic>
      data={topicClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.TOPIC}
      onUpdate={async () => noop()}>
      <TopicSchemaFields />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.DATA_MODEL]: () => (
    <GenericProvider<DashboardDataModel>
      data={dashboardDataModelClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.DASHBOARD_DATA_MODEL}
      onUpdate={async () => noop()}>
      <ModelTab />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.CONTAINER_CHILDREN]: () => (
    <GenericProvider<Container>
      data={containerDetailsClassBase.getDummyData()}
      permissions={DEFAULT_ENTITY_PERMISSION}
      type={EntityType.CONTAINER}
      onUpdate={async () => noop()}>
      <ContainerChildren isReadOnly />
    </GenericProvider>
  ),
  [DetailPageWidgetKeys.CHARTS_TABLE]: () => <DashboardChartTable />,
  [DetailPageWidgetKeys.EXPERTS]: () => (
    <OwnerLabel
      hasPermission={false}
      owners={domainClassBase.getDummyData().experts ?? []}
    />
  ),
} as const;
