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
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
const data = [
  {
    name: '1:00',
    cost: 1902,
    capacity: 568,
  },
  {
    name: '2:00',
    cost: 3341,
    capacity: 568,
  },
  {
    name: '3:00',
    cost: 1935,
    capacity: 568,
  },
  {
    name: '4:00',
    cost: 3008,
    capacity: 568,
  },
  {
    name: '5:00',
    cost: 1743,
    capacity: 568,
  },
  {
    name: '6:00',
    cost: 1271,
    capacity: 568,
  },
  {
    name: '7:00',
    cost: 626,
    capacity: 568,
  },
  {
    name: '8:00',
    cost: 1064,
    capacity: 568,
  },
  {
    name: '9:00',
    cost: 1443,
    capacity: 568,
  },
  {
    name: '10:00',
    cost: 2556,
    capacity: 568,
  },
  {
    name: '11:00',
    cost: 880,
    capacity: 568,
  },
  {
    name: '12:00',
    cost: 589,
    capacity: 568,
  },
];

const Capacity = ({ title }) => {
  return (
    <Card>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        <BarChart
          data={data}
          height={400}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          width={800}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="cost" fill="#9953C1" stackId="a" />
          <Bar dataKey="capacity" fill="#00A166" stackId="a" />
        </BarChart>
      </Card.Body>
    </Card>
  );
};

Capacity.propTypes = {
  title: PropTypes.string,
};

export default Capacity;
