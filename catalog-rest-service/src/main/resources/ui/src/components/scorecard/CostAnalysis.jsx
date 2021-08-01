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
