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
import React from 'react';
import { Link } from 'react-router-dom';
import { getDatasetDetailsPath } from '../../constants/constants';
const MyDataSidebar = ({ dataDetails }) => {
  const { name, tableType, fullyQualifiedName } = dataDetails;
  const getBadgeName = () => {
    switch (tableType) {
      case 'REGULAR':
        return 'table';
      case 'QUERY':
        return 'query';
      default:
        return 'table';
    }
  };
  const badgeName = getBadgeName();

  return (
    <div className="my-data-row row mb-2">
      <div className="my-data-title col-sm-8">
        <Link
          data-placement="top"
          data-testid="data-name"
          data-toggle="tooltip"
          title={name}
          to={getDatasetDetailsPath(fullyQualifiedName)}>
          {name}
        </Link>
      </div>
      <div className="col-sm-4">
        <div className={'sl-box-badge badge-' + badgeName} data-testid="badge">
          <span>{badgeName}</span>
        </div>
      </div>
    </div>
  );
};

MyDataSidebar.propTypes = {
  dataDetails: PropTypes.shape({
    name: PropTypes.string,
    id: PropTypes.string,
    tableType: PropTypes.string,
    fullyQualifiedName: PropTypes.string,
  }),
};

export default MyDataSidebar;
