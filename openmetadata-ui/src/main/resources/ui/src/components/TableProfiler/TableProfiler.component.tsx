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

import classNames from 'classnames';
import React, { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableProfile } from '../../generated/entity/data/table';
import { getConstraintIcon } from '../../utils/TableUtils';
import TableProfilerGraph from './TableProfilerGraph.component';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<{ constraint: string; colName: string }>;
};

type ProfilerGraphData = Array<{
  date: Date;
  value: number;
}>;

const TableProfiler = ({ tableProfiles, columns }: Props) => {
  const [expandedColumn, setExpandedColumn] = useState<{
    name: string;
    isExpanded: boolean;
  }>({
    name: '',
    isExpanded: false,
  });

  const modifiedData = tableProfiles?.map((tableProfile: TableProfile) => ({
    rows: tableProfile.rowCount,
    profileDate: tableProfile.profileDate,
    columnProfile: tableProfile.columnProfile,
  }));

  const columnSpecificData = columns.map((column) => {
    const data = modifiedData?.map((md) => {
      const currentColumn = md.columnProfile?.find(
        (colProfile) => colProfile.name === column.colName
      );

      return { profilDate: md.profileDate, ...currentColumn, rows: md.rows };
    });

    return {
      name: column,
      data,
      min: data?.length ? data[0].min ?? 0 : 0,
      max: data?.length ? data[0].max ?? 0 : 0,
      median: data?.length ? data[0].median ?? 0 : 0,
    };
  });

  return (
    <>
      {tableProfiles?.length ? (
        <table className="tw-w-full" data-testid="schema-table">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Column Name</th>
              <th className="tableHead-cell">Distinct Ratio (%)</th>
              <th className="tableHead-cell">Null Ratio (%)</th>
              <th className="tableHead-cell">Min</th>
              <th className="tableHead-cell">Max</th>
              <th className="tableHead-cell">Median</th>
              <th className="tableHead-cell">Standard Deviation</th>
            </tr>
          </thead>
          {columnSpecificData.map((col, colIndex) => {
            return (
              <Fragment key={colIndex}>
                <tbody className="tableBody">
                  <tr
                    className={classNames('tableBody-row')}
                    data-testid="tableBody-row">
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      <div className="tw-flex">
                        <span
                          className="tw-mr-2 tw-cursor-pointer"
                          onClick={() =>
                            setExpandedColumn((prevState) => ({
                              name: col.name.colName,
                              isExpanded:
                                prevState.name === col.name.colName
                                  ? !prevState.isExpanded
                                  : true,
                            }))
                          }>
                          {expandedColumn.name === col.name.colName ? (
                            expandedColumn.isExpanded ? (
                              <i className="fas fa-caret-down" />
                            ) : (
                              <i className="fas fa-caret-right" />
                            )
                          ) : (
                            <i className="fas fa-caret-right" />
                          )}
                        </span>
                        {col.name.constraint && (
                          <span className="tw-mr-3 tw--ml-2">
                            {getConstraintIcon(
                              col.name.constraint,
                              'tw-relative'
                            )}
                          </span>
                        )}
                        <span>{col.name.colName}</span>
                      </div>
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.uniqueProportion ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.nullProportion ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                    <td className="tw-relative tableBody-cell">{col.min}</td>
                    <td className="tw-relative tableBody-cell">{col.max}</td>
                    <td className="tw-relative tableBody-cell">{col.median}</td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.stddev ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                  </tr>
                </tbody>
                {expandedColumn.name === col.name.colName &&
                  expandedColumn.isExpanded && (
                    <tbody>
                      {col.data?.map((colData, index) => (
                        <tr
                          className={classNames(
                            'tableBody-row tw-border-0 tw-border-l tw-border-r',
                            {
                              'tw-border-b':
                                columnSpecificData.length - 1 === colIndex &&
                                col.data?.length === index + 1,
                            }
                          )}
                          key={index}>
                          <td className="tw-relative tableBody-cell">
                            <span className="tw-pl-6">
                              {colData.profilDate}
                            </span>
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.uniqueProportion ?? 0}
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.nullProportion ?? 0}
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.min ?? 0}
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.max ?? 0}
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.median ?? 0}
                          </td>
                          <td className="tw-relative tableBody-cell">
                            {colData.stddev ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
              </Fragment>
            );
          })}
        </table>
      ) : (
        <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
          <span>
            Data Profiler is an optional configuration in Ingestion. Please
            enable the data profiler by following the documentation
          </span>
          <Link
            className="tw-ml-1"
            target="_blank"
            to={{
              pathname: 'https://docs.open-metadata.org/connectors',
            }}>
            here.
          </Link>
        </div>
      )}
    </>
  );
};

export default TableProfiler;
