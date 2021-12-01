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

import PropTypes from 'prop-types';
import React from 'react';
import { Card } from 'react-bootstrap';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const data = [
  {
    name: '1:00',
    value: 1902,
  },
  {
    name: '2:00',
    value: 3341,
  },
  {
    name: '3:00',
    value: 1935,
  },
  {
    name: '4:00',
    value: 3008,
  },
  {
    name: '5:00',
    value: 1743,
  },
  {
    name: '6:00',
    value: 1271,
  },
  {
    name: '7:00',
    value: 626,
  },
  {
    name: '8:00',
    value: 1064,
  },
  {
    name: '9:00',
    value: 1443,
  },
  {
    name: '10:00',
    value: 2556,
  },
  {
    name: '11:00',
    value: 880,
  },
  {
    name: '12:00',
    value: 589,
  },
];

const Queries = ({ title }) => {
  return (
    <Card>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        <ComposedChart
          data={data}
          height={400}
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
          width={800}>
          <CartesianGrid stroke="#f5f5f5" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar barSize={25} dataKey="value" fill="#3F699B" />
          <Line dataKey="value" stroke="#3F699B" type="monotone" />
          {/* <Scatter dataKey="cnt" fill="red" /> */}
        </ComposedChart>
      </Card.Body>
    </Card>
  );
};

Queries.propTypes = {
  title: PropTypes.string,
};

export default Queries;
