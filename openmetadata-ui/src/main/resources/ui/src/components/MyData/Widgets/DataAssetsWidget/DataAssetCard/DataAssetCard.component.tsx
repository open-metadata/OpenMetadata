/*
 *  Copyright 2024 Collate.
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
import { Card, Typography } from 'antd';
import { capitalize } from 'lodash';
import { Bucket } from 'Models';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getExplorePath } from '../../../../../constants/constants';
import { getServiceLogo } from '../../../../../utils/CommonUtils';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import '../data-assets-widget.less';
interface DataAssetCardProps {
  service: Bucket;
}

const DataAssetCard = ({ service: { key, doc_count } }: DataAssetCardProps) => {
  const redirectLink = useMemo(
    () =>
      getExplorePath({
        tab: serviceUtilClassBase.getDataAssetsService(key),
        extraParameters: {
          page: '1',
          quickFilter: JSON.stringify({
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        {
                          term: {
                            serviceType: key,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          }),
        },
      }),
    [key]
  );

  return (
    <Link
      className="no-underline"
      data-testid={`data-asset-service-${key}`}
      to={redirectLink}>
      <Card className="service-card" data-testid="service-card" size="small">
        <div
          className="p-t-xs d-flex justify-center items-center"
          data-testid="service-icon">
          {getServiceLogo(capitalize(key) ?? '', 'h-8')}
        </div>

        <Typography.Text
          className="m-t-xss text-base text-grey-body font-medium truncate w-full d-inline-block"
          data-testid={`service-name-${key}`}>
          {capitalize(key)}
        </Typography.Text>

        <Typography.Text
          className="p-t-xs p-b-xss text-grey-muted font-normal"
          data-testid={`service-count-${key}`}>
          {doc_count}
        </Typography.Text>
      </Card>
    </Link>
  );
};

export default DataAssetCard;
