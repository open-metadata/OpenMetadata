import PropTypes from 'prop-types';
import React from 'react';
import { Card } from 'react-bootstrap';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
} from 'recharts';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const data = [
  {
    name: 'Nov',
    value: 278,
  },
  {
    name: 'Dec',
    value: 293,
  },
];

const renderCustomizedLabel = (props) => {
  const { x, y, width, value } = props;

  return (
    <g>
      <text
        dominantBaseline="middle"
        fill="#000"
        textAnchor="middle"
        x={x + width / 2}
        y={y + 10}>
        {value}
      </text>
    </g>
  );
};

const Cost = ({ title }) => {
  return (
    <Card style={{ height: '200px' }}>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        <div style={{ display: 'flex' }}>
          <BarChart
            data={data}
            height={150}
            margin={{
              top: 5,
              right: 20,
              left: 5,
              bottom: 5,
            }}
            width={150}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <Tooltip />
            <Bar barSize={40} dataKey="value" fill="#00A166">
              <LabelList content={renderCustomizedLabel} dataKey="value" />
            </Bar>
          </BarChart>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <h5 className="mr-2" style={{ color: '#FF5151' }}>
              5.42%
              <SVGIcons alt="arrow" icon={Icons.INCREASE_ARROW} />
              <p style={{ color: '#666666', fontSize: '14px' }}>
                INCREASE IN COST
              </p>
            </h5>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

Cost.propTypes = {
  title: PropTypes.string,
};

renderCustomizedLabel.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  value: PropTypes.string,
};

export default Cost;
