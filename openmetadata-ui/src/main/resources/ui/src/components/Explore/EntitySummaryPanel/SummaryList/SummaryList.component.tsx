/*
 *  Copyright 2022 Collate.
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

import { Col, Divider, Row, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTagGrey } from '../../../../assets/svg/tag-grey.svg';
import { MAX_CHAR_LIMIT_ENTITY_SUMMARY } from '../../../../constants/constants';
import { getEntityName, getTagValue } from '../../../../utils/CommonUtils';
import SVGIcons from '../../../../utils/SvgUtils';
import { prepareConstraintIcon } from '../../../../utils/TableUtils';
import RichTextEditorPreviewer from '../../../common/rich-text-editor/RichTextEditorPreviewer';
import TagsViewer from '../../../tags-viewer/tags-viewer';
import { BasicColumnInfo, SummaryListProps } from './SummaryList.interface';

const { Text, Paragraph } = Typography;

export default function SummaryList({
  columns,
  charts,
  tasks,
  mlFeatures,
}: SummaryListProps) {
  const { t } = useTranslation();

  const formattedColumnsData: BasicColumnInfo[] = useMemo(() => {
    if (columns) {
      return columns.map((column) => ({
        name: column.name,
        title: <Text className="entity-title">{column.name}</Text>,
        type: column.dataType,
        tags: column.tags,
        description: column.description,
        constraint: column.constraint,
      }));
    } else if (charts) {
      return charts.map((chart) => ({
        name: chart.name,
        title: (
          <Link target="_blank" to={{ pathname: chart.chartUrl }}>
            <Space className="m-b-xs">
              <Text className="entity-title link">{getEntityName(chart)}</Text>
              <SVGIcons alt="external-link" icon="external-link" width="12px" />
            </Space>
          </Link>
        ),
        type: chart.chartType,
        tags: chart.tags,
        description: chart.description,
      }));
    } else if (tasks) {
      return tasks.map((task) => ({
        name: task.name,
        title: (
          <Link target="_blank" to={{ pathname: task.taskUrl }}>
            <Space className="m-b-xs">
              <Text className="entity-title link">{task.name}</Text>
              <SVGIcons alt="external-link" icon="external-link" width="12px" />
            </Space>
          </Link>
        ),
        type: task.taskType,
        tags: task.tags,
        description: task.description,
      }));
    } else if (mlFeatures) {
      return mlFeatures.map((feature) => ({
        algorithm: feature.featureAlgorithm,
        name: feature.name || '--',
        title: <Text className="entity-title">{feature.name}</Text>,
        type: feature.dataType,
        tags: feature.tags,
        description: feature.description,
      }));
    } else {
      return [];
    }
  }, [columns, charts, tasks, mlFeatures]);

  return (
    <Row>
      {isEmpty(formattedColumnsData) ? (
        <div className="m-y-md">
          <Text className="text-gray">{t('message.no-data-available')}</Text>
        </div>
      ) : (
        formattedColumnsData.map((entity) => (
          <Col key={entity.name} span={24}>
            <Row gutter={[0, 4]}>
              <Col span={24}>
                {columns &&
                  prepareConstraintIcon(
                    entity.name,
                    entity.constraint,
                    undefined,
                    'm-r-xss',
                    '14px'
                  )}
                {entity.title}
              </Col>
              <Col span={24}>
                <Row className="text-xs font-300" gutter={[4, 4]}>
                  <Col>
                    {entity.type && (
                      <Space size={4}>
                        <Text className="text-gray">{`${t(
                          'label.type'
                        )}:`}</Text>
                        <Text className="font-medium">{entity.type}</Text>
                      </Space>
                    )}
                  </Col>

                  {entity.algorithm && (
                    <>
                      <Col>
                        <Divider type="vertical" />
                      </Col>
                      <Col>
                        <Space size={4}>
                          <Text className="text-gray">{`${t(
                            'label.algorithm'
                          )}:`}</Text>
                          <Text className="font-medium">
                            {entity.algorithm}
                          </Text>
                        </Space>
                      </Col>
                    </>
                  )}
                  {entity.tags && entity.tags.length !== 0 && (
                    <>
                      <Col>
                        <Divider type="vertical" />
                      </Col>
                      <Col className="flex-grow">
                        <Space>
                          <IconTagGrey className="w-12 h-12" />
                          <Row wrap>
                            <TagsViewer
                              sizeCap={-1}
                              tags={(entity.tags || []).map((tag) =>
                                getTagValue(tag)
                              )}
                            />
                          </Row>
                        </Space>
                      </Col>
                    </>
                  )}
                </Row>
              </Col>
              <Col span={24}>
                <Paragraph>
                  {entity.description ? (
                    <RichTextEditorPreviewer
                      markdown={entity.description || ''}
                      maxLength={MAX_CHAR_LIMIT_ENTITY_SUMMARY}
                    />
                  ) : (
                    t('label.no-description')
                  )}
                </Paragraph>
              </Col>
            </Row>
            <Divider />
          </Col>
        ))
      )}
    </Row>
  );
}
