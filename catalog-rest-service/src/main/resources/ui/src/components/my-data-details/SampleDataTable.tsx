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

import classNames from 'classnames';
import { lowerCase } from 'lodash';
import React, { FunctionComponent } from 'react';
import { TableData } from '../../generated/entity/data/table';
import { isEven } from '../../utils/CommonUtils';

export type SampleColumns = { name: string; dataType: string };

type Props = {
  sampleData: {
    columns: Array<SampleColumns>;
    rows: TableData['rows'];
  };
};

const SampleDataTable: FunctionComponent<Props> = ({ sampleData }: Props) => {
  return (
    <div className="tw-table-responsive">
      <table
        className="tw-min-w-max tw-w-full tw-table-auto"
        data-testid="sample-data-table">
        <thead>
          <tr className="tableHead-row">
            {sampleData.columns.map((column) => {
              return (
                <th
                  className="tableHead-cell"
                  data-testid="column-name"
                  key={column.name}>
                  {column.name}
                  <span className="tw-py-0.5 tw-px-1 tw-ml-1 tw-rounded tw-text-grey-muted">
                    ({lowerCase(column.dataType)})
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="tw-text-gray-600 tw-text-sm">
          {sampleData?.rows?.map((row, rowIndex) => {
            return (
              <tr
                className={classNames(
                  'tableBody-row',
                  !isEven(rowIndex + 1) ? 'odd-row' : null
                )}
                data-testid="row"
                key={rowIndex}>
                {row.map((data, index) => {
                  return (
                    <td
                      className="tableBody-cell"
                      data-testid="cell"
                      key={index}>
                      {data ? data.toString() : '--'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SampleDataTable;
