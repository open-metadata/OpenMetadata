import PropTypes from 'prop-types';
import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const DataAsset = ({ title, data }) => {
  return (
    <div>
      <Card style={{ height: '300px' }}>
        <Card.Body>
          <Card.Title className="graphs-title">{title}</Card.Title>
          <Row>
            {data.map((obj) => {
              return (
                <Col className="data-container" key={obj.name} sm={4}>
                  {obj.name.match(/NEW/g) ? (
                    <SVGIcons alt="Home" icon={Icons.UP_ARROW} />
                  ) : (
                    <SVGIcons alt="Home" icon={Icons.DOWN_ARROW} />
                  )}
                  <div className="asset-value">{obj.value}</div>
                  <div className="asset-name mb-3">{obj.name}</div>
                </Col>
              );
            })}
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

DataAsset.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      name: PropTypes.string,
    })
  ),
};

export default DataAsset;
