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

import { Col, Divider, Row, Space, Typography } from 'antd';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTagGrey } from '../../../../../assets/svg/tag-grey.svg';
import { MAX_CHAR_LIMIT_ENTITY_SUMMARY } from '../../../../../constants/constants';
import { getTagValue } from '../../../../../utils/CommonUtils';
import { prepareConstraintIcon } from '../../../../../utils/TableUtils';
import RichTextEditorPreviewer from '../../../../common/rich-text-editor/RichTextEditorPreviewer';
import { SummaryListItemProps } from './SummaryListItems.interface';

const { Text, Paragraph } = Typography;

function SummaryListItem({
  entityDetails,
  isColumnsData,
}: SummaryListItemProps) {
  const { t } = useTranslation();

  return (
    <Col key={entityDetails.name} span={24}>
      <Row gutter={[0, 4]}>
        <Col data-testid="title-container" span={24}>
          {isColumnsData &&
            prepareConstraintIcon(
              entityDetails.name,
              entityDetails.columnConstraint,
              entityDetails.tableConstraints,
              'm-r-xss',
              '14px'
            )}
          {entityDetails.title}
        </Col>
        <Col span={24}>
          <Row className="text-xs font-300" gutter={[4, 4]}>
            <Col>
              {entityDetails.type && (
                <Space size={4}>
                  <Text className="text-gray">{`${t('label.type')}:`}</Text>
                  <Text className="font-medium" data-testid="entity-type">
                    {entityDetails.type}
                  </Text>
                </Space>
              )}
            </Col>

            {entityDetails.algorithm && (
              <>
                <Col>
                  <Divider type="vertical" />
                </Col>
                <Col>
                  <Space size={4}>
                    <Text className="text-gray">{`${t(
                      'label.algorithm'
                    )}:`}</Text>
                    <Text className="font-medium" data-testid="algorithm">
                      {entityDetails.algorithm}
                    </Text>
                  </Space>
                </Col>
              </>
            )}
            {entityDetails.tags && entityDetails.tags.length !== 0 && (
              <>
                <Col>
                  <Divider type="vertical" />
                </Col>
                <Col className="flex-grow">
                  <Space>
                    <IconTagGrey
                      className="w-12 h-12"
                      data-testid="tag-grey-icon"
                    />
                    <Row wrap>
                      <TagsViewer
                        sizeCap={-1}
                        tags={(entityDetails.tags || []).map((tag) =>
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
            {entityDetails.description ? (
              <RichTextEditorPreviewer
                markdown={entityDetails.description || ''}
                maxLength={MAX_CHAR_LIMIT_ENTITY_SUMMARY}
              />
            ) : (
              t('label.no-entity', { entity: t('label.description') })
            )}
          </Paragraph>
        </Col>
      </Row>
      <Divider />
    </Col>
  );
}

export default SummaryListItem;
