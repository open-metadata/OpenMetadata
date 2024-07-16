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
import classNames from 'classnames';
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTeamAndUserDetailsPath } from '../../../../constants/constants';
import { CSMode } from '../../../../enums/codemirror.enum';
import {
  APIEndpoint,
  TagLabel,
} from '../../../../generated/entity/data/apiEndpoint';
import { getApiEndPointByFQN } from '../../../../rest/apiEndpointsAPI';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelUtils';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

interface APIEndpointSummaryProps {
  entityDetails: APIEndpoint;
  componentType?: string;
  tags?: TagLabel[];
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const APIEndpointSummary = ({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: APIEndpointSummaryProps) => {
  const { t } = useTranslation();

  const [apiEndpointDetails, setApiEndpointDetails] =
    useState<APIEndpoint>(entityDetails);
  const [viewType, setViewType] = useState<string>('request-schema');

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
        </Row>
        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={
            tags ??
            getSortedTagsWithHighlight(
              entityDetails.tags,
              get(highlights, 'tag.name')
            )
          }
        />
        <Divider className="m-y-xs" />

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Radio.Group value={viewType} onChange={handleViewChange}>
              <Radio.Button value="request-schema">
                {t('label.request-schema')}
              </Radio.Button>
              <Radio.Button value="response-schema">
                {t('label.response-schema')}
              </Radio.Button>
            </Radio.Group>
          </Col>
          <Col span={24}>
            <SchemaEditor
              className="custom-code-mirror-theme custom-query-editor"
              editorClass={classNames('table-query-editor')}
              mode={{ name: CSMode.JAVASCRIPT }}
              options={{
                styleActiveLine: false,
              }}
              value={
                viewType === 'request-schema'
                  ? JSON.stringify(apiEndpointDetails.requestSchema)
                  : JSON.stringify(apiEndpointDetails.responseSchema)
              }
            />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
};

export default APIEndpointSummary;
