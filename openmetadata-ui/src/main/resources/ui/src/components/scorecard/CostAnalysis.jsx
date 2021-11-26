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
import { Card } from 'react-bootstrap';
import speedometer from '../../assets/img/speed-o-meeter.png';

const CostAnalysis = ({ title }) => {
  return (
    <Card style={{ height: '200px' }}>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '50%' }}>
            <h5 className="mr-2" style={{ fontSize: '24px', color: '#000' }}>
              $1,678,348
            </h5>
            <p className="graph-title">ACTUAL</p>
            <h5 className="mr-2" style={{ fontSize: '24px', color: '#000' }}>
              $2,000,000
            </h5>
            <p className="graph-title">TOTAL BUDGET</p>
          </div>
          <img alt="speedometer" height="130px" src={speedometer} />
        </div>
      </Card.Body>
    </Card>
  );
};

CostAnalysis.propTypes = {
  title: PropTypes.string,
};

export default CostAnalysis;
