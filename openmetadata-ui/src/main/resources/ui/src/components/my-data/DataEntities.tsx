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

type DataEntitiesProps = {
  data: { name: string; color: string; value: number };
  selectedEntity: Function;
};

const DataEntities: React.FC<DataEntitiesProps> = ({
  data,
  selectedEntity,
}) => {
  return (
    <div className="filter-group mb-2" style={{ color: `${data.color}` }}>
      <input
        className="mr-1"
        type="checkbox"
        onClick={(e) => {
          selectedEntity(e, data.name);
        }}
      />
      {data.name}
      <span
        className="ml-1"
        data-testid="team-size"
        style={{ color: '#5e5c58' }}>
        ({data.value})
      </span>
    </div>
  );
};

DataEntities.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
  }).isRequired,
  selectedEntity: PropTypes.func.isRequired,
};

export default DataEntities;
