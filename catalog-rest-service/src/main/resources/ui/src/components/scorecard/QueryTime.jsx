import PropTypes from 'prop-types';
import React from 'react';
import { Card } from 'react-bootstrap';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const data = [
  {
    name: 'Dec 1',
    value: 0,
  },
  {
    name: 'Dec 8',
    value: 110,
  },
  {
    name: 'Dec 15',
    value: 188,
  },
  {
    name: 'Dec 22',
    value: 280,
  },
  {
    name: 'Dec 29',
    value: 400,
  },
];

const QueryTime = ({ title }) => {
  return (
    <div>
      <Card style={{ height: '300px' }}>
        <Card.Body>
          <Card.Title className="graphs-title">{title}</Card.Title>

          <AreaChart
            data={data}
            height={240}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
            width={500}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis
              label={{ value: 'minutes', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Area
              dataKey="value"
              fill="#00A166"
              stroke="#00A166"
              type="monotone"
            />
          </AreaChart>
        </Card.Body>
      </Card>
    </div>
  );
};

QueryTime.propTypes = {
  title: PropTypes.string,
};

export default QueryTime;
