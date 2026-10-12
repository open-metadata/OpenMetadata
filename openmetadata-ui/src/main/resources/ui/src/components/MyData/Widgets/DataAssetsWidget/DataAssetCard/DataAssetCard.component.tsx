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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { toString } from 'lodash';
import type { Bucket } from 'Models';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DataAssetServiceLogo,
  getDataAssetExploreTab,
  getFormattedDataAssetServiceType,
} from '../../../../../utils/DataAssetServiceUtils';
import { getServiceTypeExploreQueryFilter } from '../../../../../utils/FilterQueryUtils';
import { getExplorePath } from '../../../../../utils/RouterUtils';
import AppBadge from '../../../../common/Badge/Badge.component';
import '../data-assets-widget.less';

interface DataAssetCardProps {
  service: Bucket;
}

const DataAssetCard = ({ service: { key, doc_count } }: DataAssetCardProps) => {
  const redirectLink = useMemo(
    () =>
      getExplorePath({
        tab: getDataAssetExploreTab(key),
        extraParameters: {
          page: '1',
          quickFilter: getServiceTypeExploreQueryFilter(key),
          defaultServiceType: key,
        },
      }),
    [key]
  );
  const formattedServiceType = useMemo(
    () => getFormattedDataAssetServiceType(key),
    [key]
  );

  return (
    <Link
      className="no-underline"
      data-testid={`data-asset-service-${key}`}
      to={redirectLink}>
      <Box
        align="center"
        className="service-card tw:h-full tw:cursor-pointer tw:rounded-lg tw:bg-surface tw:px-5 tw:py-3 tw:text-center tw:transition-colors tw:duration-300 tw:ease-in-out tw:hover:bg-primary_hover"
        data-testid="service-card"
        direction="col">
        <Box align="center" data-testid="service-icon" justify="center">
          <DataAssetServiceLogo className="h-8" serviceType={key} />
        </Box>

        <Typography
          className="tw:mt-3 tw:inline-block tw:w-full tw:truncate tw:text-sm tw:font-medium tw:text-primary"
          data-testid={`service-name-${key}`}>
          {formattedServiceType}
        </Typography>

        <AppBadge
          className="data-asset-badge m-t-sm tw:bg-brand-primary!"
          label={toString(doc_count)}
        />
      </Box>
    </Link>
  );
};

export default DataAssetCard;
