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

import { Col, Divider, Radio, RadioChangeEvent, Row, Typography } from 'antd';
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTeamAndUserDetailsPath } from '../../../../constants/constants';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { APIEndpoint } from '../../../../generated/entity/data/apiEndpoint';
import { getApiEndPointByFQN } from '../../../../rest/apiEndpointsAPI';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import { SchemaViewType } from '../../../APIEndpoint/APIEndpointSchema/APIEndpointSchema';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface APIEndpointSummaryProps {
  entityDetails: APIEndpoint;
  componentType?: DRAWER_NAVIGATION_OPTIONS;
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const APIEndpointSummary = ({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  isLoading,
  highlights,
}: APIEndpointSummaryProps) => {
  const { t } = useTranslation();

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.API_ENDPOINT, entityDetails),
    [entityDetails]
  );

  const [apiEndpointDetails, setApiEndpointDetails] =
    useState<APIEndpoint>(entityDetails);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.REQUEST_SCHEMA
  );

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  const ownerDetails = useMemo(() => {
    const owner = entityDetails.owner;

    return {
      value: <OwnerLabel hasPermission={false} owner={owner} />,
      url: getTeamAndUserDetailsPath(owner?.name ?? ''),
      isLink: !isEmpty(owner?.name),
    };
  }, [entityDetails, apiEndpointDetails]);

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
          fields: 'tags,owner',
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
  }, [entityDetails, componentType]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          {!isExplore ? (
            <Col className="p-b-md" span={24}>
              {ownerDetails.isLink ? (
                <Link
                  component={Typography.Link}
                  to={{ pathname: ownerDetails.url }}>
                  {ownerDetails.value}
                </Link>
              ) : (
                <Typography.Text className="text-grey-muted">
                  {ownerDetails.value}
                </Typography.Text>
              )}
            </Col>
          ) : null}
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={componentType}
              entityInfo={entityInfo}
            />
          </Col>
        </Row>
        <Divider className="m-y-xs" />
        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={getSortedTagsWithHighlight(
            entityDetails.tags,
            get(highlights, 'tag.name')
          )}
        />
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
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
      </>
    </SummaryPanelSkeleton>
  );
};

export default APIEndpointSummary;
