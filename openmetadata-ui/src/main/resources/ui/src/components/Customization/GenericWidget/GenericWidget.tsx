/*
 *  Copyright 2024 Collate.
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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Card, Space } from 'antd';
import { noop, startCase } from 'lodash';
import React, { useMemo } from 'react';
import {
  DUMMY_OWNER_LIST,
  DUMMY_TAGS_LIST,
} from '../../../constants/CustomizeWidgets.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  Container,
  EntityReference,
  TagSource,
} from '../../../generated/entity/data/container';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { FrequentlyJoinedTables } from '../../../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import TableConstraints from '../../../pages/TableDetailsPageV1/TableConstraints/TableConstraints';
import containerDetailsClassBase from '../../../utils/ContainerDetailsClassBase';
import customizeGlossaryTermPageClassBase from '../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import dashboardDataModelClassBase from '../../../utils/DashboardDataModelClassBase';
import domainClassBase from '../../../utils/Domain/DomainClassBase';
import { renderReferenceElement } from '../../../utils/GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import tableClassBase from '../../../utils/TableClassBase';
import topicClassBase from '../../../utils/TopicClassBase';
import { ExtensionTable } from '../../common/CustomPropertyTable/ExtensionTable';
import { DomainLabel } from '../../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagButton from '../../common/TagButton/TagButton.component';
import ContainerChildren from '../../Container/ContainerChildren/ContainerChildren';
import { DashboardChartTable } from '../../Dashboard/DashboardChartTable/DashboardChartTable';
import ModelTab from '../../Dashboard/DataModel/DataModels/ModelTab/ModelTab.component';
import SchemaTable from '../../Database/SchemaTable/SchemaTable.component';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import GlossaryTermTab from '../../Glossary/GlossaryTermTab/GlossaryTermTab.component';
import { useGlossaryStore } from '../../Glossary/useGlossary.store';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import TopicSchemaFields from '../../Topic/TopicSchema/TopicSchema';
import { GenericProvider } from '../GenericProvider/GenericProvider';

export const GenericWidget = (props: WidgetCommonProps) => {
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  const { setGlossaryChildTerms } = useGlossaryStore();

  useMemo(() => {
    if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)
    ) {
      setGlossaryChildTerms(
        customizeGlossaryTermPageClassBase.getGlossaryChildTerms()
      );
    }

    return () => setGlossaryChildTerms([]);
  }, [props.widgetKey]);

  const widgetName = startCase(props.widgetKey.replace('KnowledgePanel.', ''));

  const cardContent = useMemo(() => {
    if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.GLOSSARY_TERMS) ||
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.RELATED_TERMS)
    ) {
      return (
        <TagsViewer
          displayType={DisplayType.READ_MORE}
          showNoDataPlaceholder={false}
          tagType={TagSource.Glossary}
          tags={DUMMY_TAGS_LIST}
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.SYNONYMS)
    ) {
      return (
        <TagButton
          className="glossary-synonym-tag"
          key="synonym"
          label="synonym"
        />
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.DOMAIN_TYPE)) {
      return domainClassBase.getDummyData().domainType;
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.DOMAIN) ||
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.DOMAIN)
    ) {
      return (
        <DomainLabel
          domain={
            { type: EntityType.DOMAIN, name: 'Engineering' } as EntityReference
          }
          entityFqn="Engineering"
          entityId="123"
          entityType={EntityType.DOMAIN}
          hasPermission={false}
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.REFERENCES)
    ) {
      return [
        {
          name: 'Google',
          endpoint: 'https://www.google.com',
        },
        {
          name: 'Collate',
          endpoint: 'https://www.getcollate.io',
        },
      ].map((term) => renderReferenceElement(term));
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.TAGS) ||
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TAGS)
    ) {
      return (
        <TagsViewer
          displayType={DisplayType.READ_MORE}
          showNoDataPlaceholder={false}
          tagType={TagSource.Classification}
          tags={DUMMY_TAGS_LIST}
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.OWNER)
    ) {
      return <OwnerLabel hasPermission={false} owners={DUMMY_OWNER_LIST} />;
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.CUSTOM_PROPERTIES) ||
      props.widgetKey.startsWith(
        GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES
      )
    ) {
      return (
        <ExtensionTable
          extension={{
            email: 'customproperty@OpenMetadata.com',
            name: 'OpenMetadata',
          }}
          tableClassName="m-0"
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.REVIEWER)
    ) {
      return <OwnerLabel hasPermission={false} owners={DUMMY_OWNER_LIST} />;
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.DESCRIPTION) ||
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.DESCRIPTION)
    ) {
      return (
        // eslint-disable-next-line max-len
        <RichTextEditorPreviewerV1 markdown="Glossary related to describing **conceptual** terms related to a Person. These terms are used to label data assets to describe the user data in those assets. Example - a table column can be labeled with `Person.PhoneNumber` tag. The associated `PII` and `PersonalData` tags are automatically applied. This is done to help users producing the data  focus on describing the data without being policy experts. The associated tags take care of applying classification tags automatically." />
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.TABLE_SCHEMA)) {
      return (
        <GenericProvider<Table>
          data={tableClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.TABLE}
          onUpdate={async () => noop()}>
          <SchemaTable />
        </GenericProvider>
      );
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES)
    ) {
      return (
        <GenericProvider<Table>
          data={tableClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.TABLE}
          onUpdate={async () => noop()}>
          <FrequentlyJoinedTables />
        </GenericProvider>
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.DATA_PRODUCTS)) {
      return (
        <DataProductsContainer
          dataProducts={tableClassBase.getDummyData().dataProducts ?? []}
          hasPermission={false}
          showHeader={false}
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)
    ) {
      return (
        <GlossaryTermTab
          isGlossary
          permissions={DEFAULT_ENTITY_PERMISSION}
          refreshGlossaryTerms={noop}
          termsLoading={false}
          onAddGlossaryTerm={noop}
          onEditGlossaryTerm={noop}
        />
      );
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.TABLE_CONSTRAINTS)
    ) {
      return (
        <GenericProvider<Table>
          data={tableClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.TABLE}
          onUpdate={async () => noop()}>
          <TableConstraints />
        </GenericProvider>
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.TOPIC_SCHEMA)) {
      return (
        <GenericProvider<Topic>
          data={topicClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.TOPIC}
          onUpdate={async () => noop()}>
          <TopicSchemaFields />
        </GenericProvider>
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.DATA_MODEL)) {
      return (
        <GenericProvider<DashboardDataModel>
          data={dashboardDataModelClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.DASHBOARD_DATA_MODEL}
          onUpdate={async () => noop()}>
          <ModelTab />
        </GenericProvider>
      );
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.CONTAINER_CHILDREN)
    ) {
      return (
        <GenericProvider<Container>
          data={containerDetailsClassBase.getDummyData()}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.CONTAINER}
          onUpdate={async () => noop()}>
          <ContainerChildren />
        </GenericProvider>
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.CHARTS_TABLE)) {
      return <DashboardChartTable />;
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.EXPERTS)) {
      return (
        <OwnerLabel
          hasPermission={false}
          owners={domainClassBase.getDummyData().experts ?? []}
        />
      );
    }

    return widgetName;
  }, [props.widgetKey]);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full"
      title={
        <div className="d-flex justify-between align-center">
          <span>{widgetName}</span>
          {props.isEditView && (
            <Space size={8}>
              <DragOutlined
                className="drag-widget-icon cursor-pointer"
                data-testid="drag-widget-button"
                size={14}
              />
              <CloseOutlined
                data-testid="remove-widget-button"
                size={14}
                onClick={handleRemoveClick}
              />
            </Space>
          )}
        </div>
      }>
      {cardContent}
    </Card>
  );
};
