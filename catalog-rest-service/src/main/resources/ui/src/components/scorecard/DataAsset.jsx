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
