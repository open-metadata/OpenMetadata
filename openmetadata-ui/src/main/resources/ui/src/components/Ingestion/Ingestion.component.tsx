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

import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import cronstrue from 'cronstrue';
import { capitalize, isNil, lowerCase } from 'lodash';
import React, { Fragment, useCallback, useState } from 'react';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import {
  AirflowPipeline,
  ConfigClass,
  PipelineType,
} from '../../generated/operations/pipelines/airflowPipeline';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { isEven } from '../../utils/CommonUtils';
import { getAirflowPipelineTypes } from '../../utils/ServiceUtils';
import { Button } from '../buttons/Button/Button';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import Searchbar from '../common/searchbar/Searchbar';
import IngestionModal from '../IngestionModal/IngestionModal.component';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { Props } from './ingestion.interface';

const Ingestion: React.FC<Props> = ({
  serviceType = '',
  serviceName,
  ingestionList,
  serviceList,
  isRequiredDetailsAvailable,
  deleteIngestion,
  triggerIngestion,
  addIngestion,
  updateIngestion,
  paging,
  pagingHandler,
}: Props) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const showToast = useToastContext();
  const [searchText, setSearchText] = useState('');
  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
    state: '',
  });
  const [updateSelection, setUpdateSelection] = useState({
    id: '',
    name: '',
    state: '',
    ingestion: {} as AirflowPipeline,
  });
  const noConnectionMsg = `${serviceName} doesn't have connection details filled in. Please add the details before scheduling an ingestion job.`;

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const getAirflowPipelineTypeOption = (): PipelineType[] => {
    const types = getAirflowPipelineTypes(serviceType) || [];

    return ingestionList.reduce((prev, curr) => {
      const index = prev.indexOf(curr.pipelineType);
      if (index > -1) {
        prev.splice(index, 1);
      }

      return prev;
    }, types);
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

  const handleUpdate = (ingestion: AirflowPipeline) => {
    setUpdateSelection({
      id: ingestion.id as string,
      name: ingestion.name,
      state: '',
      ingestion: ingestion,
    });
    setIsUpdating(true);
  };

  const handleCancelUpdate = () => {
    setUpdateSelection({
      id: '',
      name: '',
      state: '',
      ingestion: {} as AirflowPipeline,
    });
    setIsUpdating(false);
  };
  const handleUpdateIngestion = (
    data: AirflowPipeline,
    triggerIngestion?: boolean
  ) => {
    const { pipelineConfig } = updateSelection.ingestion;
    const updatedData: AirflowPipeline = {
      ...updateSelection.ingestion,
      pipelineConfig: {
        ...pipelineConfig,
        config: {
          ...(pipelineConfig.config as ConfigClass),

          ...(data.pipelineConfig.config as ConfigClass),
        },
      },
      scheduleInterval: data.scheduleInterval,
    };
    setUpdateSelection((prev) => ({ ...prev, state: 'waiting' }));
    updateIngestion(
      updatedData as AirflowPipeline,
      updateSelection.ingestion,
      updateSelection.id,
      updateSelection.name,
      triggerIngestion
    )
      .then(() => {
        setTimeout(() => {
          setUpdateSelection((prev) => ({ ...prev, state: 'success' }));
          handleCancelUpdate();
        }, 500);
      })
      .catch(() => {
        handleCancelUpdate();
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

  const handleAddIngestionClick = () => {
    if (!getAirflowPipelineTypeOption().length) {
      showToast({
        variant: 'info',
        body: `${serviceName} already has all the supported ingestion jobs added.`,
      });
    } else {
      setIsAdding(true);
    }
  };

  const getSearchedIngestions = useCallback(() => {
    const sText = lowerCase(searchText);

    return sText
      ? ingestionList.filter(
          (ing) =>
            lowerCase(ing.displayName).includes(sText) ||
            lowerCase(ing.name).includes(sText)
        )
      : ingestionList;
  }, [searchText, ingestionList]);

  const getStatuses = (ingestion: AirflowPipeline) => {
    const lastFiveIngestions = ingestion.pipelineStatuses
      ?.sort((a, b) => {
        // Turn your strings into millis, and then subtract them
        // to get a value that is either negative, positive, or zero.
        const date1 = new Date(a.startDate || '');
        const date2 = new Date(b.startDate || '');

        return date1.getTime() - date2.getTime();
      })
      .slice(Math.max(ingestion.pipelineStatuses.length - 5, 0));

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
    <Fragment>
      <div className="tw-px-4" data-testid="ingestion-container">
        <div className="tw-flex">
          {!isRequiredDetailsAvailable && (
            <div className="tw-rounded tw-bg-error-lite tw-text-error tw-font-medium tw-px-4 tw-py-1 tw-mb-4 tw-flex tw-items-center tw-gap-1">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <p> {noConnectionMsg} </p>
            </div>
          )}
        </div>
        <div className="tw-flex">
          <div className="tw-w-4/12">
            {searchText || getSearchedIngestions().length > 0 ? (
              <Searchbar
                placeholder="Search for ingestion..."
                searchValue={searchText}
                typingInterval={500}
                onSearch={handleSearchAction}
              />
            ) : null}
          </div>
          <div className="tw-w-8/12 tw-flex tw-justify-end">
            {isRequiredDetailsAvailable && (
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <Button
                  className={classNames('tw-h-8 tw-rounded tw-mb-2', {
                    'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                  })}
                  data-testid="add-new-ingestion-button"
                  size="small"
                  theme="primary"
                  variant="contained"
                  onClick={handleAddIngestionClick}>
                  Add Ingestion
                </Button>
              </NonAdminAction>
            )}
          </div>
        </div>
        {getSearchedIngestions().length ? (
          <div className="tw-table-responsive tw-mb-6">
            <table
              className="tw-bg-white tw-w-full tw-mb-4"
              data-testid="ingestion-table">
              <thead>
                <tr className="tableHead-row" data-testid="table-header">
                  <th className="tableHead-cell">Name</th>
                  <th className="tableHead-cell">Type</th>
                  <th className="tableHead-cell">Schedule</th>
                  <th className="tableHead-cell">Recent Runs</th>
                  {/* <th className="tableHead-cell">Next Run</th> */}
                  <th className="tableHead-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="tableBody">
                {getSearchedIngestions().map((ingestion, index) => (
                  <tr
                    className={classNames(
                      'tableBody-row',
                      !isEven(index + 1) ? 'odd-row' : null
                    )}
                    key={index}>
                    <td className="tableBody-cell">{ingestion.name}</td>
                    <td className="tableBody-cell">{ingestion.pipelineType}</td>
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
                    {/* <td className="tableBody-cell">
                    {ingestion.nextExecutionDate || '--'}
                  </td> */}
                    <td className="tableBody-cell">
                      <NonAdminAction
                        position="bottom"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <div className="tw-flex">
                          <button
                            className="link-text tw-mr-2"
                            data-testid="run"
                            onClick={() =>
                              handleTriggerIngestion(
                                ingestion.id as string,
                                ingestion.name
                              )
                            }>
                            {currTriggerId.id === ingestion.id ? (
                              currTriggerId.state === 'success' ? (
                                <FontAwesomeIcon icon="check" />
                              ) : (
                                <Loader size="small" type="default" />
                              )
                            ) : (
                              'Run'
                            )}
                          </button>
                          <button
                            className="link-text tw-mr-2"
                            data-testid="edit"
                            disabled={!isRequiredDetailsAvailable}
                            onClick={() => handleUpdate(ingestion)}>
                            {updateSelection.id === ingestion.id ? (
                              updateSelection.state === 'success' ? (
                                <FontAwesomeIcon icon="check" />
                              ) : (
                                <Loader size="small" type="default" />
                              )
                            ) : (
                              'Edit'
                            )}
                          </button>
                          <button
                            className="link-text tw-mr-2"
                            data-testid="delete"
                            onClick={() =>
                              ConfirmDelete(
                                ingestion.id as string,
                                ingestion.name
                              )
                            }>
                            {deleteSelection.id === ingestion.id ? (
                              deleteSelection.state === 'success' ? (
                                <FontAwesomeIcon icon="check" />
                              ) : (
                                <Loader size="small" type="default" />
                              )
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </NonAdminAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
              <NextPrevious paging={paging} pagingHandler={pagingHandler} />
            )}
          </div>
        ) : (
          <div className="tw-flex tw-items-center tw-flex-col">
            {isRequiredDetailsAvailable && ingestionList.length === 0 && (
              <div className="tw-mt-24">
                <p className="tw-text-lg tw-text-center">
                  {`No ingestion workflows found ${
                    searchText ? `for "${searchText}"` : ''
                  }`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {isAdding ? (
        <IngestionModal
          addIngestion={(data, triggerIngestion) => {
            setIsAdding(false);
            addIngestion(data, triggerIngestion);
          }}
          header="Add Ingestion"
          ingestionList={ingestionList}
          ingestionTypes={getAirflowPipelineTypeOption()}
          name=""
          service={serviceName}
          serviceList={serviceList.map((s) => ({
            name: s.name,
            serviceType: s.serviceType,
          }))}
          serviceType={serviceType}
          type=""
          onCancel={() => setIsAdding(false)}
        />
      ) : null}
      {isUpdating ? (
        <IngestionModal
          isUpdating
          header={<span>{`Edit ${updateSelection.name}`}</span>}
          ingestionList={ingestionList}
          ingestionTypes={getAirflowPipelineTypes(serviceType) || []}
          selectedIngestion={updateSelection.ingestion}
          service={serviceName}
          serviceList={serviceList.map((s) => ({
            name: s.name,
            serviceType: s.serviceType,
          }))}
          serviceType={serviceType}
          updateIngestion={(data, triggerIngestion) => {
            setIsUpdating(false);
            handleUpdateIngestion(data, triggerIngestion);
          }}
          onCancel={() => handleCancelUpdate()}
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
              <FontAwesomeIcon icon="check" />
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
    </Fragment>
  );
};

export default Ingestion;
