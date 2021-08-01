import React, { useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import Select from 'react-select';
import { getTeams } from '../../axiosAPIs/userAPI';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const tierOptions = [
  { label: 'Tier 1', value: 'Tier 1' },
  { label: 'Tier 2', value: 'Tier 2' },
  { label: 'Tier 3', value: 'Tier 3' },
];

const dateFilters = ['Today', 'Month', 'Year'];

const Filters = () => {
  const [teamOptions, setTeamOptions] = useState({});
  const [selectedTeam, setSelectedTeam] = useState({
    label: 'All',
    value: 'All',
  });
  const [selectedTier, setSelectedTier] = useState({
    label: 'Tier 1',
    value: 'Tier 1',
  });

  const [dateFilter, setSelectedDateFilter] = useState('Today');
  useEffect(() => {
    getTeams().then((res) => {
      const teamsList = res.data;
      const teamsArr = teamsList.map((obj) => {
        return { label: obj.instance?.name, value: obj.instance?.name };
      });
      setTeamOptions(teamsArr);
    });
  }, []);

  const handleTeam = (selectedOption) => {
    setSelectedTeam(selectedOption);
  };

  const handleTier = (selectedOption) => {
    setSelectedTier(selectedOption);
  };

  const handleDateFilter = (value) => {
    setSelectedDateFilter(value);
  };

  return (
    <div className="filter-wrapper">
      <div className="left-side-filter">
        <Row style={{ minWidth: '100%', marginLeft: '0px' }}>
          <SVGIcons alt="Filter" icon={Icons.FILTERS} />
          <span className="ml-3 scorecard-filter">Teams :</span>
          <Col sm={2}>
            <Select
              options={teamOptions}
              value={selectedTeam}
              onChange={handleTeam}
            />
          </Col>
          <span className="ml-3 scorecard-filter">Tiers :</span>
          <Col sm={2}>
            <Select
              options={tierOptions}
              value={selectedTier}
              onChange={handleTier}
            />
          </Col>
        </Row>
      </div>
      <div>
        {dateFilters.map((filter) => (
          <span
            className={`date-filter ${
              filter === dateFilter ? 'selected-date-filter' : ''
            }`}
            key={filter}
            onClick={() => handleDateFilter(filter)}>
            {filter}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Filters;
