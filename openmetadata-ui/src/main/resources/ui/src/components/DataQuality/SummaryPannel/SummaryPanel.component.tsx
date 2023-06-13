/*
 *  Copyright 2023 Collate.
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
import { Col, Row } from 'antd';
import { LastRunGraph } from 'components/common/LastRunGraph/LastRunGraph.component';
import { SummaryCard } from 'components/common/SummaryCard/SummaryCard.component';
import React from 'react';

export const SummaryPanel = () => {
  return (
    <Row gutter={16}>
      <Col flex="20%">
        <SummaryCard description={32} title="Success" type="success" />
      </Col>
      <Col flex="20%">
        <SummaryCard description={112893} title="Aborted" type="aborted" />
      </Col>
      <Col flex="20%">
        <SummaryCard description={112893} title="Failed" type="failed" />
      </Col>
      <Col flex="20%">
        <SummaryCard description={112893} title="Success Percentage" />
      </Col>
      <Col flex="20%">
        <SummaryCard description={<LastRunGraph />} title="Latest Results" />
      </Col>
    </Row>
  );
};
