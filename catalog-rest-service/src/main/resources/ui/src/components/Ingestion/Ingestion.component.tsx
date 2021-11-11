import classNames from 'classnames';
import { capitalize } from 'lodash';
import React, { useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { useAuth } from '../../hooks/authHooks';
import { isEven } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import PageContainer from '../containers/PageContainer';
import IngestionModal from '../IngestionModal/IngestionModal.component';

const MOCK_INGESTIONS = [
  {
    name: 'BigQuery Ingest',
    type: 'Usage',
    service: 'BigQuery',
    schedule: '1 day, 00:00:00',
    reecentRuns: ['error', 'success', 'error', 'success', 'error'],
    nextRun: '2021-11-19 14:00:00',
  },
  {
    name: 'Snowflake Ingest',
    type: 'Profiler',
    service: 'Snowflake',
    schedule: '1 day, 00:00:00',
    reecentRuns: ['error', 'success', 'error', 'success', 'error'],
    nextRun: '2021-11-19 14:00:00',
  },
  {
    name: 'Some Random Name',
    type: 'Metadata',
    service: 'Snowflake',
    schedule: '1 day, 00:00:00',
    reecentRuns: ['error', 'success', 'error', 'success', 'error'],
    nextRun: '2021-11-19 14:00:00',
  },
  {
    name: 'Untitled Ingestion',
    type: 'Metadata',
    service: 'Snowflake',
    schedule: '1 day, 00:00:00',
    reecentRuns: ['error', 'success', 'error', 'success', 'error'],
    nextRun: '2021-11-19 14:00:00',
  },
  {
    name: 'Redshift Ingest',
    type: 'Usage',
    service: 'Redshift',
    schedule: '1 day, 00:00:00',
    reecentRuns: ['error', 'success', 'error', 'success', 'error'],
    nextRun: '2021-11-19 14:00:00',
  },
];

const Ingestion = () => {
  const { isAdminUser, isAuthDisabled } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <PageContainer className="tw-bg-white">
      <div className="tw-px-4">
        <div className="tw-flex">
          <div className="tw-w-4/12">
            <Searchbar
              placeholder="Search for ingestion..."
              searchValue={searchText}
              typingInterval={500}
              onSearch={handleSearchAction}
            />
          </div>
          <div className="tw-w-8/12 tw-flex tw-justify-end">
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                className={classNames('tw-h-8 tw-rounded tw-mb-2', {
                  'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                })}
                data-testid="add-new-user-button"
                size="small"
                theme="primary"
                variant="contained"
                onClick={() => setIsAdding(true)}>
                Add Ingestion
              </Button>
            </NonAdminAction>
          </div>
        </div>
        <div className="tw-table-responsive tw-my-6">
          <table className="tw-w-full" data-testid="ingestion-table">
            <thead>
              <tr className="tableHead-row">
                <th className="tableHead-cell">Name</th>
                <th className="tableHead-cell">Type</th>
                <th className="tableHead-cell">Service</th>
                <th className="tableHead-cell">Schedule</th>
                <th className="tableHead-cell">Reecent Runs</th>
                <th className="tableHead-cell">Next Run</th>
                <th className="tableHead-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="tableBody">
              {MOCK_INGESTIONS.map((ingestion, index) => (
                <tr
                  className={classNames(
                    'tableBody-row',
                    !isEven(index + 1) ? 'odd-row' : null
                  )}
                  key={index}>
                  <td className="tableBody-cell">{ingestion.name}</td>
                  <td className="tableBody-cell">{ingestion.type}</td>
                  <td className="tableBody-cell">{ingestion.service}</td>
                  <td className="tableBody-cell">{ingestion.schedule}</td>
                  <td className="tableBody-cell">
                    <div className="tw-flex">
                      {ingestion.reecentRuns
                        .sort(() => Math.random() - 0.5)
                        .map((r, i) => {
                          if (i === ingestion.reecentRuns.length - 1) {
                            return (
                              <p
                                className={`tw-h-5 tw-w-16 tw-rounded-sm tw-bg-${r} tw-mr-2 tw-px-1 tw-text-white tw-text-center`}
                                key={i}>
                                {capitalize(r)}
                              </p>
                            );
                          } else {
                            return (
                              <p
                                className={`tw-w-4 tw-h-5 tw-rounded-sm tw-bg-${r} tw-mr-2`}
                                key={i}
                              />
                            );
                          }
                        })}
                    </div>
                  </td>
                  <td className="tableBody-cell">{ingestion.nextRun}</td>
                  <td className="tableBody-cell">
                    <div className="tw-flex tw-justify-between">
                      <p className="link-text">Run</p>
                      <p className="link-text">Edit</p>
                      <p className="link-text">Delete</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isAdding ? (
        <IngestionModal
          header="Add Ingestion"
          onCancel={() => setIsAdding(false)}
          onSave={() => setIsAdding(false)}
        />
      ) : null}
    </PageContainer>
  );
};

export default Ingestion;
