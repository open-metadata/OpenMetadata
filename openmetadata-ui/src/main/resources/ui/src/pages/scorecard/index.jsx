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

import React from 'react';
import { Col, Row } from 'react-bootstrap';
import PageContainer from '../../components/containers/PageContainer';
import Capacity from '../../components/scorecard/Capacity';
import Cost from '../../components/scorecard/Cost';
import CostAnalysis from '../../components/scorecard/CostAnalysis';
import DataAsset from '../../components/scorecard/DataAsset';
import DataQuality from '../../components/scorecard/DataQuality';
import Filters from '../../components/scorecard/Filters';
import IssueStats from '../../components/scorecard/IssueStats';
import Queries from '../../components/scorecard/Queries';
import QueryTime from '../../components/scorecard/QueryTime';
import TierDataSet from '../../components/scorecard/TierDataSet';
import { AssetStatData, IssueStatsData, QualityData } from './index.mock';

const Scorecard = () => {
  return (
    <>
      <div data-testid="filter-container">
        <Filters />
      </div>
      <PageContainer>
        <div className="container-fluid">
          <Row style={{ marginBottom: '10px' }}>
            <Col sm={3}>
              <IssueStats data={IssueStatsData} title="Issue Stats" />
            </Col>
            <Col sm={3}>
              <CostAnalysis title="Cost Analysis" />
            </Col>
            <Col sm={2}>
              <Cost title="Change In Cost" />
            </Col>
            <Col sm={4}>
              <DataQuality data={QualityData} title="Data Quality" />
            </Col>
          </Row>
          <Row style={{ marginBottom: '10px' }}>
            <Col sm={4}>
              <TierDataSet title="Tier 1 & Tier 2 Dataset" />
            </Col>
            <Col sm={4}>
              <QueryTime title="Average Query Time" />
            </Col>
            <Col sm={4}>
              <DataAsset data={AssetStatData} title="Data Asset Stats" />
            </Col>
          </Row>
          <Row style={{ marginBottom: '10px' }}>
            <Col sm={6}>
              <Queries title="Average no. of Queries" />
            </Col>
            <Col sm={6}>
              <Capacity title="Cost & Resource Capacity" />
            </Col>
          </Row>
        </div>
      </PageContainer>
    </>
  );
};

export default Scorecard;
