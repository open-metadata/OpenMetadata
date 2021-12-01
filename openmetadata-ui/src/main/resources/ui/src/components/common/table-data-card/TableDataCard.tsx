/*
 *  Copyright 2021 Collate
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

import { isString, isUndefined, startCase, uniqueId } from 'lodash';
import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { SearchIndex } from '../../../enums/search.enum';
import { TagLabel } from '../../../generated/type/tagLabel';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  getEntityIcon,
  getEntityLink,
  getUsagePercentile,
} from '../../../utils/TableUtils';
import TableDataCardBody from './TableDataCardBody';

type Props = {
  name: string;
  owner?: string;
  description?: string;
  tableType?: string;
  tier?: string | TagLabel;
  usage?: number;
  serviceType?: string;
  fullyQualifiedName: string;
  tags?: string[] | TagLabel[];
  indexType: string;
  matches?: {
    key: string;
    value: number;
  }[];
};

const TableDataCard: FunctionComponent<Props> = ({
  name,
  owner = '--',
  description,
  tier = '',
  usage,
  serviceType,
  fullyQualifiedName,
  tags,
  indexType,
  matches,
}: Props) => {
  const getTier = () => {
    if (tier) {
      return isString(tier) ? tier : tier.tagFQN;
    }

    return 'No Tier';
  };

  const OtherDetails = [
    { key: 'Owner', value: owner },
    { key: 'Service', value: serviceType },
    { key: 'Tier', value: getTier() },
  ];
  if (indexType !== SearchIndex.DASHBOARD && usage !== undefined) {
    OtherDetails.push({
      key: 'Usage',
      value:
        indexType !== SearchIndex.DASHBOARD && usage !== undefined
          ? getUsagePercentile(usage)
          : undefined,
    });
  }
  const getAssetTags = () => {
    const assetTags = [...(tags as Array<TagLabel>)];
    if (tier && !isUndefined(tier)) {
      assetTags
        // .filter((tag) => !tag.tagFQN.includes((tier as TagLabel).tagFQN))
        .unshift(tier as TagLabel);
    }

    return [...new Set(assetTags)];
  };

  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="table-data-card">
      <div>
        <div className="tw-flex">
          {getEntityIcon(indexType)}
          <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
            <Link
              data-testid="table-link"
              to={getEntityLink(indexType, fullyQualifiedName)}>
              <button className="tw-text-grey-body tw-font-medium">
                {stringToHTML(name)}
              </button>
            </Link>
          </h6>
        </div>
      </div>
      <div className="tw-pt-3">
        <TableDataCardBody
          description={description || ''}
          extraInfo={OtherDetails}
          tags={getAssetTags()}
        />
      </div>
      {matches && matches.length > 0 ? (
        <div className="tw-pt-2">
          <span className="tw-text-grey-muted">Matches :</span>
          {matches.map((data, i) => (
            <span className="tw-ml-2" key={uniqueId()}>
              {`${data.value} in ${startCase(data.key)}${
                i !== matches.length - 1 ? ',' : ''
              }`}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TableDataCard;
