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

import { Col, Radio, RadioChangeEvent, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { APIEndpoint } from '../../../../generated/entity/data/apiEndpoint';
import { getApiEndPointByFQN } from '../../../../rest/apiEndpointsAPI';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { SchemaViewType } from '../../../APIEndpoint/APIEndpointSchema/APIEndpointSchema';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface APIEndpointSummaryProps {
  entityDetails: APIEndpoint;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const APIEndpointSummary = ({
  entityDetails,
  highlights,
}: APIEndpointSummaryProps) => {
  const { t } = useTranslation();

  const [apiEndpointDetails, setApiEndpointDetails] =
    useState<APIEndpoint>(entityDetails);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.REQUEST_SCHEMA
  );

  const { formattedSchemaFieldsData, activeSchema } = useMemo(() => {
    const activeSchema =
      viewType === SchemaViewType.REQUEST_SCHEMA
        ? apiEndpointDetails.requestSchema
        : apiEndpointDetails.responseSchema;

    const formattedSchemaFieldsData: BasicEntityInfo[] = getFormattedEntityData(
      SummaryEntityType.SCHEMAFIELD,
      activeSchema?.schemaFields,
      highlights
    );

    return {
      formattedSchemaFieldsData,
      activeSchema,
    };
  }, [apiEndpointDetails, highlights, viewType]);

  const fetchApiEndpointDetails = useCallback(async () => {
    try {
      const res = await getApiEndPointByFQN(
        entityDetails.fullyQualifiedName ?? '',
        {
          fields: [TabSpecificField.TAGS, TabSpecificField.OWNERS],
        }
      );

      setApiEndpointDetails({ ...res });
    } catch (error) {
      // Error
    }
  }, [entityDetails]);

  const handleViewChange = (e: RadioChangeEvent) => {
    setViewType(e.target.value);
  };

  useEffect(() => {
    if (entityDetails.service?.type === 'apiService') {
      fetchApiEndpointDetails();
    }
  }, [entityDetails]);

  return (
    <Row className="p-md border-radius-card" gutter={[0, 8]}>
      <Col span={24}>
        <Radio.Group value={viewType} onChange={handleViewChange}>
          <Radio.Button value={SchemaViewType.REQUEST_SCHEMA}>
            {t('label.request')}
          </Radio.Button>
          <Radio.Button value={SchemaViewType.RESPONSE_SCHEMA}>
            {t('label.response')}
          </Radio.Button>
        </Radio.Group>
      </Col>
      <Col span={24}>
        {isEmpty(activeSchema?.schemaFields) ? (
          <Typography.Text data-testid="no-data-message">
            <Typography.Text className="text-grey-body">
              {t('message.no-data-available')}
            </Typography.Text>
          </Typography.Text>
        ) : (
          <SummaryList formattedEntityData={formattedSchemaFieldsData} />
        )}
      </Col>
    </Row>
  );
};

export default APIEndpointSummary;
