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

import { lowerCase } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { mockFilters } from '../../mocks/feedsFilters.mock';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import MyDataSidebar from '../my-data/MyDataSidebar';
import TeamsDataSidebar from '../teams/TeamsDataSidebar';
import { ReactComponent as IconDefaultUserProfile } from './../../assets/svg/ic-default-profile.svg';
const viewAllData = 'View all data';
const viewAllTeams = 'View all teams';
const viewLess = 'View less';
const FeedsLeftPanel = ({ tables, teams, viewCap = 0 }) => {
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [tablesData, setTablesData] = useState(tables || []);
  const [teamsData, setTeamsData] = useState(teams || []);
  const [currentUserTeam, setCurrentUserTeam] = useState({ name: 'Test user' });
  const [showTeams, setShowTeams] = useState(true);

  useEffect(() => {
    setTablesData(tables);
  }, [tables]);

  useEffect(() => {
    setTeamsData(teams);
  }, [teams]);

  const handleTableSearch = (searchText) => {
    if (searchText) {
      setTablesData(
        tables.filter((table) =>
          lowerCase(table.name).includes(lowerCase(searchText))
        )
      );
    } else {
      setTablesData(tables);
    }
  };

  const handleTeamSearch = (searchText) => {
    if (searchText) {
      setTeamsData(
        teams.filter((table) =>
          lowerCase(table.name).includes(lowerCase(searchText))
        )
      );
    } else {
      setTeamsData(teams);
    }
  };

  const handleTeamsDropdownChange = (data, isTeam = false) => {
    setShowTeams(Boolean(!isTeam));
    setCurrentUserTeam(data);
  };

  return (
    <>
      <Dropdown>
        <Dropdown.Toggle className="teams-dropdown px-0" id="dropdown-basic">
          <div className="profile-image mr-1 tw-float-left">
            {AppState.userDetails.profile?.images.image512 ? (
              <img
                alt="profile-512"
                className=""
                src={AppState.userDetails.profile.images.image512}
              />
            ) : (
              <IconDefaultUserProfile />
            )}
          </div>
          <span className="tw-leading-6 tw-font-medium">
            {currentUserTeam.name} <DropdownIcon />
          </span>
        </Dropdown.Toggle>

        <Dropdown.Menu
          className="tw-mt-1 tw-w-52 tw-rounded-md tw-shadow-lg
              tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-0 focus:tw-outline-none"
          style={{ padding: '4px 0px' }}>
          <Dropdown.Item
            className="tw-text-gray-700 tw-block tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-gray-200"
            onClick={() => handleTeamsDropdownChange({ name: 'Test user' })}>
            Test user
          </Dropdown.Item>
          {teamsData.length > 0 &&
            teamsData.map((teamDetails, index) => (
              <React.Fragment key={index}>
                <Dropdown.Item
                  className="tw-text-gray-700 tw-block tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-gray-200"
                  onClick={() => handleTeamsDropdownChange(teamDetails, true)}>
                  {teamDetails.name}
                </Dropdown.Item>
              </React.Fragment>
            ))}
          <Dropdown.Item className="tw-text-gray-700 tw-block tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-gray-200">
            Create new team
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <div className="seperator mb-3 mt-2" />
      <h6>Filters</h6>
      <div className="sidebar-filters-holder mt-2 mb-3">
        {mockFilters.map((filter, index) => {
          return (
            <div className="filters-row mb-2" key={index}>
              <div className="filters-title">{filter.name}</div>
              <div className="filter-size">
                <span data-testid="filter-count">{filter.count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="seperator mb-3" />
      <h6>My Data</h6>
      <div className="has-search" data-testid="my-data-search">
        <input
          className="form-control form-control-sm search"
          placeholder="Search datatable..."
          type="text"
          onChange={(e) => {
            handleTableSearch(e.target.value);
          }}
        />
      </div>
      <div className="sidebar-my-data-holder mt-2 mb-3">
        {tablesData.slice(0, viewCap).map((dataDetails, index) => {
          return <MyDataSidebar dataDetails={dataDetails} key={index} />;
        })}
        <div className="my-data-row mb-2">
          <Link className="link-text" to="/my-data">
            {viewAllData}
          </Link>
        </div>
      </div>

      {showTeams && (
        <>
          <div className="seperator mb-3" />
          <h6>My Teams</h6>
          <div className="has-search" data-testid="my-team-search">
            <input
              className="form-control form-control-sm search"
              placeholder="Search team..."
              type="text"
              onChange={(e) => {
                handleTeamSearch(e.target.value);
              }}
            />
          </div>
          <div className="sidebar-teams-holder mt-2 mb-3">
            {(showAllTeams || teamsData.length <= viewCap
              ? teamsData
              : teamsData.slice(0, viewCap)
            ).map((teamDetails, index) => {
              return <TeamsDataSidebar key={index} teamDetails={teamDetails} />;
            })}
            {viewCap && teamsData.length > viewCap && (
              <div className="my-data-row mb-2">
                <div className="link-text">
                  <span onClick={() => setShowAllTeams((show) => !show)}>
                    {!showAllTeams ? viewAllTeams : viewLess}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

FeedsLeftPanel.propTypes = {
  tables: PropTypes.array.isRequired,
  teams: PropTypes.array.isRequired,
  viewCap: PropTypes.number,
};

export default FeedsLeftPanel;
