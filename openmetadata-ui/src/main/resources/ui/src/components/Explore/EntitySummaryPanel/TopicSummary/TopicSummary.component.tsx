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

import { Col, Divider, Row, Typography } from 'antd';
import { isArray, isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTopicByFqn } from 'rest/topicsAPI';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Topic } from '../../../../generated/entity/data/topic';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { getConfigObject } from '../../../../utils/TopicDetailsUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import { TopicConfigObjectInterface } from '../../../TopicDetails/TopicDetails.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface TopicSummaryProps {
  entityDetails: Topic;
}

function TopicSummary({ entityDetails }: TopicSummaryProps) {
  const { t } = useTranslation();
  const [topicDetails, setTopicDetails] = useState<Topic>(entityDetails);

  const topicConfig = useMemo(() => {
    const configs = getConfigObject(topicDetails);

    return {
      ...configs,
      'Retention Size': bytesToSize(configs['Retention Size'] ?? 0),
      'Max Message Size': bytesToSize(configs['Max Message Size'] ?? 0),
    };
  }, [topicDetails]);

  const formattedSchemaFieldsData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.SCHEMAFIELD,
        topicDetails.messageSchema?.schemaFields
      ),
    [topicDetails]
  );

  const fetchExtraTopicInfo = async () => {
    try {
      const res = await getTopicByFqn(
        entityDetails.fullyQualifiedName ?? '',
        ''
      );

      const { partitions, messageSchema } = res;

      setTopicDetails({ ...entityDetails, partitions, messageSchema });
    } catch {
      showErrorToast(
        t('server.entity-details-fetch-error', {
          entityType: t('label.topic-lowercase'),
          entityName: entityDetails.name,
        })
      );
    }
  };

  useEffect(() => {
    fetchExtraTopicInfo();
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

              const fieldValue = isArray(value) ? value.join(', ') : value;

              return (
                <Col key={fieldName} span={24}>
                  <Row gutter={16}>
                    <Col
                      className="text-gray"
                      data-testid={`${fieldName}-label`}
                      span={10}>
                      {fieldName}
                    </Col>
                    <Col data-testid={`${fieldName}-value`} span={12}>
                      {fieldValue ? fieldValue : '-'}
                    </Col>
                  </Row>
                </Col>
              );
            })}
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className="m-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="section-header"
            data-testid="schema-header">
            {t('label.schema')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {isEmpty(topicDetails.messageSchema?.schemaFields) ? (
            <div className="m-y-md">
              <Typography.Text
                className="text-gray"
                data-testid="no-data-message">
                {t('message.no-data-available')}
              </Typography.Text>
            </div>
          ) : (
            <SummaryList formattedEntityData={formattedSchemaFieldsData} />
          )}
        </Col>
      </Row>
    </>
  );
}

export default TopicSummary;
