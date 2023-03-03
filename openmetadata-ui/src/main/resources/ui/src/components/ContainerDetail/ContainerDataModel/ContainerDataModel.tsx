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
import { Popover, Space, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { NO_DATA_PLACEHOLDER } from 'constants/constants';
import { Column, Container } from 'generated/entity/data/container';
import { isEmpty, toLower } from 'lodash';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTableExpandableConfig } from 'utils/TableUtils';

interface ContainerDataModelProps {
  dataModel: Container['dataModel'];
}

const ContainerDataModel: FC<ContainerDataModelProps> = ({ dataModel }) => {
  const { t } = useTranslation();

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 300,
        render: (name: Column['name']) => (
          <Space
            align="start"
            className="w-max-90 vertical-align-inherit"
            size={2}>
            <span className="break-word">{name}</span>
          </Space>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 220,
        render: (dataTypeDisplay: Column['dataTypeDisplay']) => {
          return (
            <Popover
              destroyTooltipOnHide
              content={toLower(dataTypeDisplay)}
              overlayInnerStyle={{
                maxWidth: '420px',
                overflowWrap: 'break-word',
                textAlign: 'center',
              }}
              trigger="hover">
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay}
              </Typography.Text>
            </Popover>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: (description: Column['description']) => (
          <div>
            {description ? (
              <RichTextEditorPreviewer markdown={description} />
            ) : (
              <span className="tw-no-description">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </div>
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 350,
        render: () => <>{NO_DATA_PLACEHOLDER}</>,
      },
    ],
    []
  );

  return (
    <Table
      bordered
      columns={columns}
      data-testid="entity-table"
      dataSource={dataModel?.columns}
      expandable={{
        ...getTableExpandableConfig<Column>(),
        rowExpandable: (record) => !isEmpty(record.children),
      }}
      pagination={false}
      size="small"
    />
  );
};

export default ContainerDataModel;
