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

import { Col, Row, Space } from 'antd';
import { Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { MAX_CHAR_LIMIT_ENTITY_SUMMARY } from '../../../../../constants/constants';
import { prepareConstraintIcon } from '../../../../../utils/TableUtils';
import { getTagValue } from '../../../../../utils/TagsPureUtils';
import AppBadge from '../../../../common/Badge/Badge.component';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../../../Tag/TagsViewer/TagsViewer';
import { SummaryListItemProps } from './SummaryListItems.interface';

function SummaryListItem({
  entityDetails,
  isColumnsData,
}: SummaryListItemProps) {
  const { t } = useTranslation();

  return (
    <Col data-testid="summary-list-item" key={entityDetails.name} span={24}>
      <div className="summary-list-item-container">
        <Row gutter={[0, 8]}>
          <Col
            className="d-flex items-baseline"
            data-testid="title-container"
            span={24}>
            {isColumnsData &&
              prepareConstraintIcon({
                columnName: entityDetails.name,
                columnConstraint: entityDetails.columnConstraint,
                tableConstraints: entityDetails.tableConstraints,
                iconClassName: 'm-r-xss',
                iconWidth: '14px',
              })}
            <Typography
              ellipsis={{ tooltip: entityDetails.title }}
              className="m-r-xs">
              {entityDetails.title}
            </Typography>

            {entityDetails.type && (
              <AppBadge
                bgColor="#E6DDFF80"
                className="m-l-auto"
                color="#703EFD"
                data-testid="entity-type"
                label={entityDetails.type}
              />
            )}
          </Col>

          {entityDetails.algorithm && (
            <Col span={24}>
              <Space className="h-6" size={4}>
                <Typography className="text-grey-muted">{`${t(
                  'label.algorithm'
                )}:`}</Typography>
                <Typography
                  data-testid="algorithm"
                  className="font-medium text-grey-body">
                  {entityDetails.algorithm}
                </Typography>
              </Space>
            </Col>
          )}

          <Col span={24}>
            <Typography as='p' className="text-grey-body m-y-0">
              {entityDetails.description ? (
                <RichTextEditorPreviewerV1
                  markdown={entityDetails.description || ''}
                  maxLength={MAX_CHAR_LIMIT_ENTITY_SUMMARY}
                />
              ) : (
                <Typography className="text-sm no-data-chip-placeholder">
                  {t('label.no-entity', { entity: t('label.description') })}
                </Typography>
              )}
            </Typography>
          </Col>
          {entityDetails.tags && entityDetails.tags.length !== 0 && (
            <Col className="flex-grow" data-testid="tags-viewer" span={24}>
              <TagsViewer
                sizeCap={2}
                tags={(entityDetails.tags || []).map((tag) => getTagValue(tag))}
              />
            </Col>
          )}
        </Row>
      </div>
    </Col>
  );
}

export default SummaryListItem;
