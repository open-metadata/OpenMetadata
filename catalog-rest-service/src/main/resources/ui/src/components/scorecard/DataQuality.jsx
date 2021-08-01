import PropTypes from 'prop-types';
import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const DataQuality = ({ title, data }) => {
  return (
    <Card style={{ height: '200px' }}>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        <Row>
          {data.map((obj) => {
            return (
              <Col className="data-container" key={obj.name} sm={4}>
                {obj.value.charAt(0) === '+' ? (
                  <SVGIcons alt="Home" icon={Icons.UP_ARROW} />
                ) : (
                  <SVGIcons alt="Home" icon={Icons.DOWN_ARROW} />
                )}
                <div className="quality-value mb-2 mt-2">{obj.value}</div>
                <div className="quality-name">{obj.name}</div>
              </Col>
            );
          })}
        </Row>
      </Card.Body>
    </Card>
  );
};

DataQuality.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      name: PropTypes.string,
    })
  ),
};

export default DataQuality;
