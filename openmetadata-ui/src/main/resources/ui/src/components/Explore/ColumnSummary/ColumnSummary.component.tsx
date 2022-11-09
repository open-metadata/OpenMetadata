/*
 *  Copyright 2022 Collate
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

import { Divider, Space, Typography } from 'antd';
import { toLower } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTagValue } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import TagsViewer from '../../tags-viewer/tags-viewer';
import { BasicColumnInfo, ColumnSummaryProps } from './ColumnSummary.interface';

const { Text, Paragraph } = Typography;

export default function ColumnSummary({ columns }: ColumnSummaryProps) {
  const { t } = useTranslation();

  const formattedColumnsData: BasicColumnInfo[] = useMemo(() => {
    if (columns) {
      return columns.map((column) => ({
        name: column.name,
        type: column.dataType,
        tags: column.tags,
        description: column.description,
      }));
    } else return [];
  }, [columns]);

  return (
    <Space direction="vertical">
      {columns &&
        formattedColumnsData.map((column) => (
          <React.Fragment key={column.name}>
            <Space direction="vertical" size={0}>
              <Text className="column-name">{column.name}</Text>
              <Space className="text-xs" size={4}>
                <Space size={4}>
                  <Text className="text-gray">{`${t('label.type')}:`}</Text>
                  <Text className="text-semi-bold">{toLower(column.type)}</Text>
                </Space>
                {column.tags?.length !== 0 && (
                  <>
                    <Divider type="vertical" />
                    <Space size={4}>
                      <SVGIcons
                        alt="icon-tag"
                        icon="icon-tag-grey"
                        width="12"
                      />

                      <TagsViewer
                        sizeCap={-1}
                        tags={(column.tags || []).map((tag) =>
                          getTagValue(tag)
                        )}
                      />
                    </Space>
                  </>
                )}
              </Space>
              <Paragraph className="text-gray">
                {column.description ? (
                  <RichTextEditorPreviewer
                    markdown={column.description || ''}
                  />
                ) : (
                  t('label.no-description')
                )}
              </Paragraph>
            </Space>
            <Divider />
          </React.Fragment>
        ))}
    </Space>
  );
}
