/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { getDatasetDetailsPath } from '../../../constants/constants';
import { getBadgeName, getUsagePercentile } from '../../../utils/TableUtils';
import TableDataCardBody from './TableDataCardBody';

type Props = {
  name: string;
  owner?: string;
  description?: string;
  tableType?: string;
  tier?: string;
  usage?: number;
  serviceType?: string;
  fullyQualifiedName: string;
  tags?: string[];
};

const TableDataCard: FunctionComponent<Props> = ({
  name,
  owner = '--',
  description,
  tableType,
  tier = 'No Tier',
  usage,
  serviceType,
  fullyQualifiedName,
  tags,
}: Props) => {
  const percentile = getUsagePercentile(usage || 0);
  const badgeName = getBadgeName(tableType);
  const OtherDetails = [
    { key: 'Owner', value: owner },
    { key: 'Service Type', value: serviceType },
    { key: 'Usage', value: percentile },
    { key: 'Tier', value: tier },
  ];

  return (
    <div className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md">
      <div>
        <h6 className="tw-flex tw-items-center tw-m-0 tw-heading">
          <Link to={getDatasetDetailsPath(fullyQualifiedName)}>
            <button className="tw-text-grey-body tw-font-medium">
              {name + ' '}
            </button>
          </Link>
          <span
            className={
              'tw-ml-2 tw-text-xs tw-uppercase tw-tracking-widest tw-rounded tw-px-2 tw-py-1 badge-' +
              badgeName
            }
            data-testid="badge">
            {badgeName}
          </span>
        </h6>
      </div>
      <div className="tw-pt-2">
        <TableDataCardBody
          description={description || ''}
          extraInfo={OtherDetails}
          tags={[...new Set(tags)]}
        />
      </div>
    </div>
  );
};

export default TableDataCard;
