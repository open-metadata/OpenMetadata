import classNames from 'classnames';
import React, { Fragment, useState } from 'react';
import { Table, TableProfile } from '../../generated/entity/data/table';
import TableProfilerGraph from './TableProfilerGraph.component';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<string>;
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
        (colProfile) => colProfile.name === column
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
              <th className="tableHead-cell">Rows</th>
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
                      <p className="tw-flex">
                        <span
                          className="tw-mr-2 tw-cursor-pointer"
                          onClick={() =>
                            setExpandedColumn((prevState) => ({
                              name: col.name,
                              isExpanded:
                                prevState.name === col.name
                                  ? !prevState.isExpanded
                                  : true,
                            }))
                          }>
                          {expandedColumn.name === col.name ? (
                            expandedColumn.isExpanded ? (
                              <i className="fas fa-caret-down" />
                            ) : (
                              <i className="fas fa-caret-right" />
                            )
                          ) : (
                            <i className="fas fa-caret-right" />
                          )}
                        </span>
                        <span>{col.name}</span>
                      </p>
                    </td>
                    <td
                      className="tw-relative tableBody-cell profiler-graph"
                      data-testid="profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.rows ?? 0,
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
                {expandedColumn.name === col.name && expandedColumn.isExpanded && (
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
                          <span className="tw-pl-6">{colData.profilDate}</span>
                        </td>
                        <td className="tw-relative tableBody-cell">
                          <span className="tw-pl-6">{colData.rows}</span>
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
          No profiler data available
        </div>
      )}
    </>
  );
};

export default TableProfiler;
