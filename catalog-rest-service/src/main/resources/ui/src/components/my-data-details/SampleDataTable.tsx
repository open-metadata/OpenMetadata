import React, { FunctionComponent } from 'react';
import { isEven } from '../../utils/CommonUtils';

// type Column = {
//   columnConstraint?: string;
//   columnDataType: string;
//   description: string;
//   name: string;
//   ordinalPosition: number;
//   piiTags?: Array<string>;
// };

type MockColumn = {
  columnId: number;
  name: string;
  columnDataType: string;
  description?: string;
  selected?: boolean;
  piiTags?: Array<string>;
};

type Props = {
  columns: Array<MockColumn>;
  data: Array<Record<string, string>>;
};

const SampleDataTable: FunctionComponent<Props> = ({
  columns,
  data,
}: Props) => {
  return (
    <div className="tw-table-responsive">
      <table
        className="tw-min-w-max tw-w-full tw-table-auto"
        data-testid="sample-data-table">
        <thead>
          <tr className="tw-border tw-border-gray-200 tw-bg-gray-200 tw-text-gray-600 tw-text-sm tw-leading-normal">
            {columns.map((column) => {
              return (
                <th
                  className="tw-py-3 tw-px-6 tw-text-left tw-whitespace-nowrap"
                  data-testid="column-name"
                  key={column.columnId}>
                  <p className="tw-mb-2">{column.name}</p>
                  <span className={'sl-label ' + column.columnDataType}>
                    {column.columnDataType}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="tw-text-gray-600 tw-text-sm">
          {data.map((row, rowIndex) => {
            return (
              <tr
                className={`tw-border tw-border-gray-200 hover:tw-bg-gray-100 ${
                  isEven(rowIndex + 1) && 'tw-bg-gray-50'
                }`}
                data-testid="row"
                key={rowIndex}>
                {columns.map((column) => {
                  return (
                    <td
                      className="tw-py-3 tw-px-6 tw-text-left"
                      data-testid="cell"
                      key={column.columnId}>
                      {row[column.name]}
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
