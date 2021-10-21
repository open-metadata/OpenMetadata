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

import React from 'react';
import { Button } from 'react-bootstrap';
import { qualityDetails } from '../my-data-details/DatasetDetails.mock';
import DatacenterTable from './DatacenterTable';
import QualityCard from './QualityCard';
import TestsTable from './TestsTable';

const QualityTab = () => {
  const {
    freshness,
    completeness,
    duplicates,
    datacenterDetails,
    testsDetails,
  } = qualityDetails;
  const qualityStatus = () => {
    const freshnessStatus =
      freshness.lastRunsData[freshness.lastRunsData.length - 1];
    const completenessStatus =
      completeness.lastRunsData[completeness.lastRunsData.length - 1];
    const duplicatesStatus =
      duplicates.lastRunsData[duplicates.lastRunsData.length - 1];

    if (
      freshnessStatus === 'Failed' ||
      completenessStatus === 'Failed' ||
      duplicatesStatus === 'Failed'
    ) {
      return 'text-danger';
    }
    if (
      freshnessStatus === 'Unknown' ||
      completenessStatus === 'Unknown' ||
      duplicatesStatus === 'Unknown'
    ) {
      return 'text-grey';
    }

    return 'text-success';
  };
  const dataCenterStatus = () => {
    const statuses = datacenterDetails.map((datacenterDetail) => {
      const { latestRunsDetails } = datacenterDetail;

      return latestRunsDetails[latestRunsDetails.length - 1];
    });
    let initialValue = 0;
    const failedCounter = function (counter, item) {
      if (item === 'Failed') return counter + 1;

      return counter;
    };
    const failedCount = statuses.reduce(failedCounter, initialValue);
    initialValue = 0;
    const unknownCounter = function (counter, item) {
      if (item === 'Unknown') return counter + 1;

      return counter;
    };
    const unknownCount = statuses.reduce(unknownCounter, initialValue);
    if (failedCount) {
      return 'text-danger';
    }
    if (unknownCount) {
      return 'text-grey';
    }

    return 'text-success';
  };

  return (
    <div>
      <div className="row">
        <div className="col-sm-12">
          <div className="clearfix mb-3">
            <div className="float-left">
              <h4 className="quality-title">
                <i
                  className={
                    'quality-status-icon fa fa-circle ' + qualityStatus()
                  }
                />{' '}
                Overall Quality{' '}
                <i className="quality-status-icon fa fa-info-circle" />
              </h4>
            </div>
            <div className="float-right">
              <Button
                data-testid="add-test-button"
                size="sm"
                variant="outline-primary">
                Add New Test
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-sm-4">
          <QualityCard
            heading={freshness.heading}
            lastRunResults={freshness.lastRunResults}
            lastRunsData={freshness.lastRunsData}
          />
        </div>
        <div className="col-sm-4">
          <QualityCard
            heading={completeness.heading}
            lastRunResults={completeness.lastRunResults}
            lastRunsData={completeness.lastRunsData}
          />
        </div>
        <div className="col-sm-4">
          <QualityCard
            heading={duplicates.heading}
            lastRunResults={duplicates.lastRunResults}
            lastRunsData={duplicates.lastRunsData}
          />
        </div>
      </div>
      <div className="row">
        <div className="col-sm-12">
          <div className="clearfix mb-3">
            <div className="float-left">
              <h5 className="quality-subtitle">
                <i
                  className={
                    'quality-status-icon fa fa-circle ' + dataCenterStatus()
                  }
                />{' '}
                Cross Datacenter Consistency{' '}
                <i className="quality-status-icon fa fa-info-circle" />
              </h5>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-sm-12">
          <DatacenterTable datacenterDetails={datacenterDetails} />
        </div>
      </div>
      <div className="row">
        <div className="col-sm-12">
          <div className="clearfix mb-3">
            <h5 className="quality-subtitle">
              <i className="quality-status-icon fa fa-circle text-grey" /> Tests{' '}
              <i className="quality-status-icon fa fa-info-circle" />
            </h5>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-sm-12">
          <TestsTable testsDetails={testsDetails} />
        </div>
      </div>
    </div>
  );
};

export default QualityTab;
