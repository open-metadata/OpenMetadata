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

import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';
import Select from 'react-select';

const styles = {
  multiValue: (base, state) => {
    return state.data.isFixed ? { ...base, backgroundColor: 'gray' } : base;
  },
  multiValueLabel: (base, state) => {
    return state.data.isFixed
      ? { ...base, fontWeight: 'bold', color: 'white', paddingRight: 6 }
      : base;
  },
  multiValueRemove: (base, state) => {
    return state.data.isFixed ? { ...base, display: 'none' } : base;
  },
};

const Edituser = ({ user, handleSave, rolesList, teamsList }) => {
  const teamsArr = user.team.map((obj) => {
    return { label: obj.name, value: obj.id, isFixed: true };
  });
  const rolesArr = user.role.map((obj) => {
    return { label: obj.name, value: obj.id, isFixed: true };
  });
  const [teams, setTeams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(teamsArr);
  const [selectedRole, setSelectedRole] = useState(rolesArr);

  useEffect(() => {
    const teamArr = teamsList.map((obj) => {
      return {
        label: obj.instance?.name,
        value: obj.instance?.id,
        isFixed: false,
      };
    });
    const rolesArr = rolesList.map((obj) => {
      return {
        label: obj.instance?.name,
        value: obj.instance?.id,
        isFixed: false,
      };
    });
    setTeams(teamArr);
    setRoles(rolesArr);
  }, [rolesList, teamsList]);

  const handleTeam = (selectedOption, { action, removedValue }) => {
    switch (action) {
      case 'remove-value':
      case 'pop-value':
        if (removedValue.isFixed) {
          return;
        }

        break;
      case 'clear':
        selectedOption = teams.filter((v) => v.isFixed);

        break;
      default:
        break;
    }
    setSelectedTeam(selectedOption);
  };

  const handleRole = (selectedOption, { action, removedValue }) => {
    switch (action) {
      case 'remove-value':
      case 'pop-value':
        if (removedValue.isFixed) {
          return;
        }

        break;
      case 'clear':
        selectedOption = roles.filter((v) => v.isFixed);

        break;
      default:
        break;
    }
    setSelectedRole(selectedOption);
  };

  const validate = () => {
    let validateFlag = true;
    if (selectedTeam === null || selectedRole === null) {
      validateFlag = false;
    }

    return validateFlag;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    } else {
      const rolesArr = selectedRole.filter((obj) => !obj.isFixed);
      const teamsArr = selectedTeam.filter((obj) => !obj.isFixed);
      handleSave(user.id, rolesArr, teamsArr);
    }
  };

  return (
    <div>
      <Form data-testid="form">
        <Form.Group as={Row} controlId="name">
          <Form.Label column sm="2">
            Name
          </Form.Label>
          <Col sm="10">
            <Form.Control plaintext readOnly defaultValue={user.name} />
          </Col>
        </Form.Group>

        <Form.Group as={Row} controlId="timezone">
          <Form.Label column sm="2">
            TimeZone
          </Form.Label>
          <Col sm="10">
            <Form.Control plaintext readOnly placeholder={user.timezone} />
          </Col>
        </Form.Group>

        <Form.Group as={Row} controlId="role">
          <Form.Label column sm="2">
            Roles
          </Form.Label>
          <Col sm="10">
            <Select
              isMulti
              isClearable={selectedRole.some((v) => {
                return !v.isFixed;
              })}
              options={roles}
              styles={styles}
              value={selectedRole}
              onChange={handleRole}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} controlId="team">
          <Form.Label column sm="2">
            Teams
          </Form.Label>
          <Col sm="10">
            <Select
              isMulti
              isClearable={selectedTeam.some((v) => {
                return !v.isFixed;
              })}
              options={teams}
              styles={styles}
              value={selectedTeam}
              onChange={handleTeam}
            />
          </Col>
        </Form.Group>
      </Form>
      <Button className="edit-user" type="submit" onClick={handleSubmit}>
        Save
      </Button>
    </div>
  );
};

Edituser.propTypes = {
  user: PropTypes.object,
  handleSave: PropTypes.func.isRequired,
  rolesList: PropTypes.array,
  teamsList: PropTypes.array,
};

export default Edituser;
