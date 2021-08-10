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

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { Team } from 'Models';
import React, { useEffect, useState } from 'react';
import {
  createTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
} from '../../axiosAPIs/teamsAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import FormModal from '../../components/Modals/FormModal';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ERROR404 } from '../../constants/constants';
import { isEven } from '../../utils/CommonUtils';
import { stringToDOMElement } from '../../utils/StringsUtils';
import SVGIcons from '../../utils/SvgUtils';
import Form from './Form';

const TeamsPage = () => {
  const [teams, setTeams] = useState<Array<Team>>([]);
  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isAddingTeam, setIsAddingTeam] = useState<boolean>(false);

  // remove once new markdown editor PR merged
  const getDescription = (description = '') => {
    const desc = stringToDOMElement(description).textContent;

    return desc && desc.length > 1 ? (
      desc
    ) : (
      <span className="tw-no-description">No description added</span>
    );
  };

  const fetchTeams = () => {
    setIsLoading(true);
    getTeams(['users', 'owns'])
      .then((res: AxiosResponse) => {
        setTeams(res.data.data);
        setCurrentTeam(res.data.data[0]);
        setIsLoading(false);
      })
      .catch((err: AxiosError) => {
        if (err?.response?.data.code) {
          setError(ERROR404);
        }
        setIsLoading(false);
      });
  };

  const fetchCurrentTeam = (name: string, update = false) => {
    if (currentTeam?.name !== name || update) {
      setIsLoading(true);
      getTeamByName(name, ['users', 'owns'])
        .then((res: AxiosResponse) => {
          setCurrentTeam(res.data);
          setIsLoading(false);
        })
        .catch((err: AxiosError) => {
          if (err?.response?.data.code) {
            setError(ERROR404);
          }
          setIsLoading(false);
        });
    }
  };

  const getCurrentTeamClass = (name: string) => {
    if (currentTeam?.name === name) {
      return 'activeCategory';
    } else {
      return '';
    }
  };
  const getActiveTabClass = (tab: number) => {
    return tab === currentTab ? 'active' : '';
  };

  const getTabs = () => {
    return (
      <div className="tw-mb-3 tw--mt-4">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(1)}`}
            onClick={() => {
              setCurrentTab(1);
            }}>
            Users
          </button>
          <button
            className={`tw-pb-2 tw-px-4 tw-gh-tabs ${getActiveTabClass(2)}`}
            onClick={() => {
              setCurrentTab(2);
            }}>
            Datasets
          </button>
        </nav>
      </div>
    );
  };

  const getUsersTable = () => {
    return (
      <div className="tw-border tw-rounded-md tw-bg-white">
        <table className="tw-w-full tw-overflow-x-auto">
          <thead>
            <tr className="tw-border-b tw-text-sm tw-leading-normal">
              <th className="tableHead-cell">Username</th>
              <th className="tableHead-cell">Display name</th>
              <th className="tableHead-cell tw-w-60">Type</th>
            </tr>
          </thead>
          <tbody className="tw-text-sm">
            {currentTeam?.users.map((user, index) => {
              return (
                <tr
                  className={`${
                    currentTeam?.users.length !== index + 1 && 'tw-border-b'
                  } tw-border-gray-200 hover:tw-bg-gray-100 ${
                    isEven(index + 1) && 'tw-bg-gray-50'
                  }`}
                  key={index}>
                  <td className="tw-py-3 tw-px-6 tw-text-left">
                    <p>{user.name}</p>
                  </td>
                  <td className="tw-py-3 tw-px-6 tw-text-left">
                    <p>{user.description.trim() || 'No description added'}</p>
                  </td>
                  <td className="tw-py-3 tw-px-6 tw-text-left">
                    <p>{user.type}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  const getDatasetTable = () => {
    return (
      <div className="tw-border tw-rounded-md tw-bg-white">
        <table className="tw-w-full tw-overflow-x-auto">
          <thead>
            <tr className="tw-border-b tw-text-sm tw-leading-normal">
              <th className="tableHead-cell">Name</th>
              <th className="tableHead-cell tw-w-60">Type</th>
            </tr>
          </thead>
          <tbody className="tw-text-sm">
            {currentTeam?.owns.map((dataset, index) => {
              return (
                <tr
                  className={`${
                    currentTeam?.users.length !== index + 1 && 'tw-border-b'
                  } tw-border-gray-200 hover:tw-bg-gray-100 ${
                    isEven(index + 1) && 'tw-bg-gray-50'
                  }`}
                  key={index}>
                  <td className="tw-py-3 tw-px-6 tw-text-left">
                    <p>{dataset.name}</p>
                  </td>
                  <td className="tw-py-3 tw-px-6 tw-text-left">
                    <p>{dataset.type}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-baseline tw-mb-3">
          <h6 className="tw-heading">Teams</h6>
          <Button
            className="tw-h-8 tw-px-3"
            size="small"
            theme="primary"
            variant="contained"
            onClick={() => setIsAddingTeam(true)}>
            +
          </Button>
        </div>
        {teams &&
          teams.map((team: Team) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getCurrentTeamClass(
                team.name
              )}`}
              key={team.name}
              onClick={() => {
                fetchCurrentTeam(team.name);
                setCurrentTab(1);
              }}>
              <p className="tw-text-center tw-self-center">
                {team.displayName}
              </p>
            </div>
          ))}
      </>
    );
  };
  const onDescriptionUpdate = (updatedHTML: string) => {
    if (currentTeam?.description !== updatedHTML) {
      const updatedTeam = { ...currentTeam, description: updatedHTML };
      const jsonPatch = compare(currentTeam as Team, updatedTeam);
      patchTeamDetail(currentTeam?.id, jsonPatch).then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentTeam(res.data.name, true);
        }
      });

      setIsEditable(false);
    } else {
      setIsEditable(false);
    }
  };
  const onDescriptionEdit = (): void => {
    setIsEditable(true);
  };

  const onCancel = (): void => {
    setIsEditable(false);
  };
  const createNewTeam = (data: Team) => {
    createTeam(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchTeams();
          setIsAddingTeam(false);
        } else {
          setIsAddingTeam(false);
        }
      })
      .catch(() => {
        setIsAddingTeam(false);
      });
  };
  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <>
      {error ? (
        <ErrorPlaceHolder />
      ) : (
        <PageContainer leftPanelContent={fetchLeftPanel()}>
          {isLoading ? (
            <Loader />
          ) : (
            <div className="container-fluid py-3">
              <div className="tw-heading tw-text-blue-600 tw-text-base">
                {currentTeam?.displayName}
              </div>
              <div className="tw-flex tw-flex-col tw-border tw-rounded-md tw-mb-3 tw-min-h-32 tw-bg-white">
                <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b">
                  <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-font-normal">
                    Description
                  </span>
                  <div className="tw-flex-initial">
                    <button
                      className="focus:tw-outline-none"
                      onClick={onDescriptionEdit}>
                      <SVGIcons alt="edit" icon="icon-edit" title="Edit" />
                    </button>
                  </div>
                </div>
                <div className="tw-px-3 tw-py-2 tw-overflow-y-auto">
                  <div data-testid="description" id="description">
                    {getDescription(currentTeam?.description.trim())}
                  </div>
                  {isEditable && (
                    <ModalWithMarkdownEditor
                      header={`Edit description for ${currentTeam?.displayName}`}
                      placeholder="Enter Description"
                      value={currentTeam?.description || ''}
                      onCancel={onCancel}
                      onSave={onDescriptionUpdate}
                    />
                  )}
                </div>
              </div>
              {getTabs()}
              {currentTab === 1 && getUsersTable()}
              {currentTab === 2 && getDatasetTable()}
              {isAddingTeam && (
                <FormModal
                  form={Form}
                  header="Adding new team"
                  initialData={{
                    name: '',
                    description: '',
                    displayName: '',
                  }}
                  onCancel={() => setIsAddingTeam(false)}
                  onSave={(data) => createNewTeam(data as Team)}
                />
              )}
            </div>
          )}
        </PageContainer>
      )}
    </>
  );
};

export default TeamsPage;
