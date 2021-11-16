import classNames from 'classnames';
import cronstrue from 'cronstrue';
import { capitalize } from 'lodash';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getServiceDetailsPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { useAuth } from '../../hooks/authHooks';
import { isEven } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import Searchbar from '../common/searchbar/Searchbar';
import PageContainer from '../containers/PageContainer';
import IngestionModal from '../IngestionModal/IngestionModal.component';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { IngestionData, Props } from './ingestion.interface';

const Ingestion: React.FC<Props> = ({
  ingestionList,
  serviceList,
  deleteIngestion,
  triggerIngestion,
  addIngestion,
}: Props) => {
  const { isAdminUser, isAuthDisabled } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
    state: '',
  });

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const handleTriggerIngestion = (id: string, displayName: string) => {
    setCurrTriggerId({ id, state: 'waiting' });
    triggerIngestion(id, displayName)
      .then(() => {
        setCurrTriggerId({ id, state: 'success' });
        setTimeout(() => setCurrTriggerId({ id: '', state: '' }), 1500);
      })
      .catch(() => setCurrTriggerId({ id: '', state: '' }));
  };

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
      state: '',
    });
  };

  const handleDelete = (id: string, displayName: string) => {
    setDeleteSelection({ id, name: displayName, state: 'waiting' });
    deleteIngestion(id, displayName)
      .then(() => {
        setTimeout(() => {
          setDeleteSelection({ id, name: displayName, state: 'success' });
          handleCancelConfirmationModal();
        }, 500);
      })
      .catch(() => {
        handleCancelConfirmationModal();
      });
  };

  const ConfirmDelete = (id: string, name: string) => {
    setDeleteSelection({
      id,
      name,
      state: '',
    });
    setIsConfirmationModalOpen(true);
  };

  const getServiceTypeFromName = (serviceName = ''): string => {
    return (
      serviceList.find((service) => service.name === serviceName)
        ?.serviceType || ''
    );
  };

  const getStatuses = (ingestion: IngestionData) => {
    const lastFiveIngestions = ingestion.ingestionStatuses
      ?.sort((a, b) => {
        // Turn your strings into millis, and then subtract them
        // to get a value that is either negative, positive, or zero.
        const date1 = new Date(a.startDate);
        const date2 = new Date(b.startDate);

        return date1.getTime() - date2.getTime();
      })
      .slice(Math.max(ingestion.ingestionStatuses.length - 5, 0));

    return lastFiveIngestions?.map((r, i) => {
      return (
        <PopOver
          html={
            <div className="tw-text-left">
              {r.startDate ? (
                <p>Start Date: {new Date(r.startDate).toUTCString()}</p>
              ) : null}
              {r.endDate ? (
                <p>End Date: {new Date(r.endDate).toUTCString()}</p>
              ) : null}
            </div>
          }
          key={i}
          position="bottom"
          theme="light"
          trigger="mouseenter">
          {i === lastFiveIngestions.length - 1 ? (
            <p
              className={`tw-h-5 tw-w-16 tw-rounded-sm tw-bg-status-${r.state} tw-mr-1 tw-px-1 tw-text-white tw-text-center`}>
              {capitalize(r.state)}
            </p>
          ) : (
            <p
              className={`tw-w-4 tw-h-5 tw-rounded-sm tw-bg-status-${r.state} tw-mr-1`}
            />
          )}
        </PopOver>
      );
    });
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
                <th className="tableHead-cell">Recent Runs</th>
                <th className="tableHead-cell">Next Run</th>
                <th className="tableHead-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="tableBody">
              {ingestionList.map((ingestion, index) => (
                <tr
                  className={classNames(
                    'tableBody-row',
                    !isEven(index + 1) ? 'odd-row' : null
                  )}
                  key={index}>
                  <td className="tableBody-cell">{ingestion.displayName}</td>
                  <td className="tableBody-cell">{ingestion.ingestionType}</td>
                  <td className="tableBody-cell">
                    <Link
                      to={getServiceDetailsPath(
                        ingestion.service.name as string,
                        getServiceTypeFromName(ingestion.service.name)
                      )}>
                      {ingestion.service.name}
                    </Link>
                  </td>
                  <td className="tableBody-cell">
                    <PopOver
                      html={
                        <div>
                          {cronstrue.toString(
                            ingestion.scheduleInterval || '',
                            {
                              use24HourTimeFormat: true,
                              verbose: true,
                            }
                          )}
                        </div>
                      }
                      position="bottom"
                      theme="light"
                      trigger="mouseenter">
                      <span>{ingestion.scheduleInterval}</span>
                    </PopOver>
                  </td>
                  <td className="tableBody-cell">
                    <div className="tw-flex">{getStatuses(ingestion)}</div>
                  </td>
                  <td className="tableBody-cell">
                    {ingestion.nextExecutionDate || '--'}
                  </td>
                  <td className="tableBody-cell">
                    <NonAdminAction
                      position="bottom"
                      title={TITLE_FOR_NON_ADMIN_ACTION}>
                      <div className="tw-flex">
                        <div
                          className="link-text tw-mr-2"
                          onClick={() =>
                            handleTriggerIngestion(
                              ingestion.id as string,
                              ingestion.displayName
                            )
                          }>
                          {currTriggerId.id === ingestion.id ? (
                            currTriggerId.state === 'success' ? (
                              <i aria-hidden="true" className="fa fa-check" />
                            ) : (
                              <Loader size="small" type="default" />
                            )
                          ) : (
                            'Run'
                          )}
                        </div>
                        <p className="link-text tw-mr-2">Edit</p>
                        <div
                          className="link-text tw-mr-2"
                          onClick={() =>
                            ConfirmDelete(
                              ingestion.id as string,
                              ingestion.displayName
                            )
                          }>
                          {deleteSelection.id === ingestion.id ? (
                            deleteSelection.state === 'success' ? (
                              <i aria-hidden="true" className="fa fa-check" />
                            ) : (
                              <Loader size="small" type="default" />
                            )
                          ) : (
                            'Delete'
                          )}
                        </div>
                      </div>
                    </NonAdminAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isAdding ? (
        <IngestionModal
          addIngestion={(data, triggerIngestion) => {
            setIsAdding(false);
            addIngestion(data, triggerIngestion);
          }}
          header="Add Ingestion"
          ingestionList={ingestionList}
          name=""
          service=""
          serviceList={serviceList.map((s) => ({
            name: s.name,
            serviceType: s.serviceType,
          }))}
          type=""
          onCancel={() => setIsAdding(false)}
        />
      ) : null}
      {isConfirmationModalOpen && (
        <ConfirmationModal
          bodyText={`You want to delete ingestion ${deleteSelection.name} permanently? This action cannot be reverted.`}
          cancelText="Discard"
          confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
          confirmText={
            deleteSelection.state === 'waiting' ? (
              <Loader size="small" type="white" />
            ) : deleteSelection.state === 'success' ? (
              <i aria-hidden="true" className="fa fa-check" />
            ) : (
              'Delete'
            )
          }
          header="Are you sure?"
          onCancel={handleCancelConfirmationModal}
          onConfirm={() =>
            handleDelete(deleteSelection.id, deleteSelection.name)
          }
        />
      )}
    </PageContainer>
  );
};

export default Ingestion;
