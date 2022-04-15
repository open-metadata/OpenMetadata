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

import { FormatedTableData } from 'Models';
import React, { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { getEntityIcon, getEntityLink } from '../../utils/TableUtils';

interface Prop {
  entityList: Array<FormatedTableData>;
  headerText: string | JSX.Element;
  noDataPlaceholder: JSX.Element;
  testIDText: string;
}

const EntityList: FunctionComponent<Prop> = ({
  entityList = [],
  headerText,
  noDataPlaceholder,
  testIDText,
}: Prop) => {
  return (
    <>
      <h6 className="tw-heading tw-mb-3" data-testid="filter-heading">
        {headerText}
      </h6>
      {entityList.length
        ? entityList.map((item, index) => {
            return (
              <div
                className="tw-flex tw-items-center tw-justify-between tw-mb-2"
                data-testid={`${testIDText}-${item.name}`}
                key={index}>
                <div className="tw-flex">
                  {getEntityIcon(item.index)}
                  <Link
                    className="tw-font-medium tw-pl-2"
                    to={getEntityLink(item.index, item.fullyQualifiedName)}>
                    <button
                      className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline tw-w-52 tw-truncate tw-text-left"
                      title={item.name}>
                      {item.name}
                    </button>
                  </Link>
                </div>
              </div>
            );
          })
        : noDataPlaceholder}
    </>
  );
};

export default EntityList;
