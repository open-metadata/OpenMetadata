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
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { DataType, Table } from '../../../../generated/entity/data/table';
import { EntityReference } from '../../../../generated/tests/testCase';
import { TagSource } from '../../../../generated/type/tagLabel';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { FrequentlyJoinedTables } from '../../../../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import { renderReferenceElement } from '../../../../utils/GlossaryUtils';
import tableClassBase from '../../../../utils/TableClassBase';
import { getJoinsFromTableJoins } from '../../../../utils/TableUtils';
import { ExtensionTable } from '../../../common/CustomPropertyTable/ExtensionTable';
import { DomainLabel } from '../../../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagButton from '../../../common/TagButton/TagButton.component';
import SchemaTable from '../../../Database/SchemaTable/SchemaTable.component';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsViewer from '../../../Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';

export const GenericWidget = (props: WidgetCommonProps) => {
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

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
          tags={[
            {
              tagFQN: 'BusinessGlossary.Purchase',
              source: TagSource.Glossary,
              name: 'Purchase',
            },
            {
              tagFQN: 'Person.BankNumber',
              source: TagSource.Glossary,
              name: 'BankNumber',
            },
            {
              tagFQN: 'Hospitality.Guest Type',
              source: TagSource.Glossary,
              name: 'Guest Type',
            },
            {
              tagFQN: 'Financial Services',
              source: TagSource.Glossary,
              name: 'Auto Loan',
            },
          ]}
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
          tags={[
            {
              tagFQN: 'General.BankNumber',
              source: TagSource.Classification,
              name: 'BankNumber',
            },
            {
              tagFQN: 'General.DriverLicense',
              source: TagSource.Classification,
              name: 'DriverLicense',
            },
            {
              tagFQN: 'PII.Sensitive',
              source: TagSource.Classification,
              name: 'Sensitive',
            },
            {
              tagFQN: 'Tier.Tier1',
              source: TagSource.Classification,
              name: 'Tier1',
            },
            {
              tagFQN: 'PersonalData.SpecialCategory',
              source: TagSource.Classification,
              name: 'SpecialCategory',
            },
          ]}
        />
      );
    } else if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.OWNER)
    ) {
      return (
        <OwnerLabel
          hasPermission={false}
          owners={[
            {
              name: 'Aaron Singh',
              type: EntityType.USER,
              id: '123',
            },
            {
              name: 'Engeeneering',
              type: EntityType.TEAM,
              id: '123',
            },
          ]}
        />
      );
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
      return (
        <OwnerLabel
          hasPermission={false}
          owners={[
            {
              name: 'Andrew Jackson',
              type: EntityType.USER,
              id: '123',
            },
            {
              name: 'Engineering',
              type: EntityType.TEAM,
              id: '123',
            },
          ]}
        />
      );
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
        <SchemaTable
          hasDescriptionEditAccess={false}
          hasGlossaryTermEditAccess={false}
          hasTagEditAccess={false}
          table={
            {
              columns: [
                {
                  name: 'address_id',
                  dataType: DataType.Numeric,
                  dataTypeDisplay: 'numeric',
                  description: 'Unique identifier for the address.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
                  tags: [],
                  ordinalPosition: 1,
                },
                {
                  name: 'shop_id',
                  dataType: DataType.Numeric,
                  dataTypeDisplay: 'numeric',
                  description:
                    'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.shop_id',
                  tags: [],
                  ordinalPosition: 2,
                },
                {
                  name: 'first_name',
                  dataType: DataType.Varchar,
                  dataLength: 100,
                  dataTypeDisplay: 'varchar',
                  description: 'First name of the customer.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.first_name',
                  tags: [],
                  ordinalPosition: 3,
                },
                {
                  name: 'last_name',
                  dataType: DataType.Varchar,
                  dataLength: 100,
                  dataTypeDisplay: 'varchar',
                  description: 'Last name of the customer.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.last_name',
                  tags: [],
                  ordinalPosition: 4,
                },
                {
                  name: 'address',
                  dataType: DataType.Varchar,
                  dataLength: 500,
                  dataTypeDisplay: 'varchar',
                  description: 'Clean address test',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.address',
                  tags: [],
                  ordinalPosition: 5,
                },
                {
                  name: 'company',
                  dataType: DataType.Varchar,
                  dataLength: 100,
                  dataTypeDisplay: 'varchar',
                  description:
                    "The name of the customer's business, if one exists.",
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.company',
                  tags: [],
                  ordinalPosition: 7,
                },
                {
                  name: 'city',
                  dataType: DataType.Varchar,
                  dataLength: 100,
                  dataTypeDisplay: 'varchar',
                  description: 'The name of the city. For example, Palo Alto.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.city',
                  tags: [],
                  ordinalPosition: 8,
                },
                {
                  name: 'region',
                  dataType: DataType.Varchar,
                  dataLength: 512,
                  dataTypeDisplay: 'varchar',
                  description:
                    // eslint-disable-next-line max-len
                    'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.region',
                  tags: [],
                  ordinalPosition: 9,
                },
                {
                  name: 'zip',
                  dataType: DataType.Varchar,
                  dataLength: 10,
                  dataTypeDisplay: 'varchar',
                  description: 'The ZIP or postal code. For example, 90210.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.zip',
                  tags: [],
                  ordinalPosition: 10,
                },
                {
                  name: 'country',
                  dataType: DataType.Varchar,
                  dataLength: 50,
                  dataTypeDisplay: 'varchar',
                  description:
                    'The full name of the country. For example, Canada.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.country',
                  tags: [],
                  ordinalPosition: 11,
                },
                {
                  name: 'phone',
                  dataType: DataType.Varchar,
                  dataLength: 15,
                  dataTypeDisplay: 'varchar',
                  description: 'The phone number of the customer.',
                  fullyQualifiedName:
                    'sample_data.ecommerce_db.shopify.dim_address_clean.phone',
                  tags: [],
                  ordinalPosition: 12,
                },
              ],
            } as unknown as Table
          }
          onThreadLinkSelect={noop}
          onUpdate={async () => noop()}
        />
      );
    } else if (
      props.widgetKey.startsWith(DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES)
    ) {
      return (
        <FrequentlyJoinedTables
          joinedTables={getJoinsFromTableJoins(
            tableClassBase.getDummyData().joins
          )}
        />
      );
    } else if (props.widgetKey.startsWith(DetailPageWidgetKeys.DATA_PRODUCTS)) {
      return (
        <DataProductsContainer
          dataProducts={tableClassBase.getDummyData().dataProducts ?? []}
          hasPermission={false}
          showHeader={false}
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
