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

import { Col, Divider, Row, Typography } from 'antd';
import { isArray } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../../enums/search.enum';
import { Topic } from '../../../../generated/entity/data/topic';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { getConfigObject } from '../../../../utils/TopicDetailsUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import SchemaEditor from '../../../schema-editor/SchemaEditor';
import { TopicConfigObjectInterface } from '../../../TopicDetails/TopicDetails.interface';

interface TopicSummaryProps {
  entityDetails: Topic;
}

function TopicSummary({ entityDetails }: TopicSummaryProps) {
  const { t } = useTranslation();

  const topicConfig = useMemo(() => {
    const configs = getConfigObject(entityDetails);

    return {
      ...configs,
      'Retention Size': bytesToSize(configs['Retention Size'] ?? 0),
      'Max Message Size': bytesToSize(configs['Max Message Size'] ?? 0),
    };
  }, [entityDetails]);

  return (
    <>
      <Row className="m-md" gutter={[0, 4]}>
        <Col span={24}>
          <TableDataCardTitle
            dataTestId="summary-panel-title"
            searchIndex={SearchIndex.TOPIC}
            source={entityDetails}
          />
        </Col>
        <Col span={24}>
          <Row>
            {Object.keys(topicConfig).map((fieldName) => {
              const value =
                topicConfig[fieldName as keyof TopicConfigObjectInterface];

              return (
                <Col key={fieldName} span={24}>
                  <Row gutter={16}>
                    <Col className="text-gray" span={10}>
                      {fieldName}
                    </Col>
                    <Col span={12}>
                      {isArray(value) ? value.join(', ') : value}
                    </Col>
                  </Row>
                </Col>
              );
            })}
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className="m-md">
        <Col span={24}>
          <Typography.Text className="section-header">
            {t('label.schema')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {entityDetails.messageSchema?.schemaText ? (
            <SchemaEditor
              editorClass="summary-schema-editor"
              value={entityDetails.messageSchema.schemaText}
            />
          ) : (
            <div className="m-y-md">
              <Typography.Text className="text-gray">
                {t('label.no-data-available')}
              </Typography.Text>
            </div>
          )}
        </Col>
      </Row>
    </>
  );
}

export default TopicSummary;
