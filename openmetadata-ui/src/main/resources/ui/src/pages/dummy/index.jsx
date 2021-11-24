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
import PageContainer from '../../components/containers/PageContainer';

const DummyPage = () => {
  return (
    <PageContainer>
      <div className="container-fluid">
        <div className="row">
          <div className="col-sm-12">
            <div className="form-group page-search-bar">
              <label>
                Search for Table, Metric, Report, Dashboard or Experiment...
              </label>
              <div className="input-group">
                <div className="input-group-prepend">
                  <span className="input-group-text">@</span>
                </div>
                <input
                  className="form-control"
                  placeholder="Search..."
                  type="text"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="clearfix mb-3">
          <div className="float-left">dropdown</div>
          <div className="float-right">Toggle</div>
        </div>
        <div className="row">
          <div className="col-sm-12">
            <div className="sl-box">
              <div className="sl-box-header">
                <h5 className="sl-title">
                  fact_order{' '}
                  <span className="sl-box-badge badge-table">table</span>
                </h5>
                <div className="sl-box-tools">
                  <button className="btn btn-like">234</button>
                  <button className="btn btn-like">...</button>
                </div>
              </div>
              <div className="sl-box-body">
                <p>
                  <strong>Description:</strong> General information about
                  orders. Do not use this table for financial calculations (use
                  the sales table instead)
                </p>
                <p>
                  Owner: <strong>Shops Org</strong> | Super Org:{' '}
                  <strong>Data</strong> | Platform:
                  <strong>HIVE</strong> | Highly used:{' '}
                  <strong>99th Percetile</strong> | Tier: <strong>Tier1</strong>{' '}
                  | Freshness: <strong>31h</strong>
                </p>
                <p>
                  <span className="text-success">Ready to use</span>
                  <a className="sl-box-link" href="#">
                    View all 18 instance
                  </a>
                </p>
              </div>
            </div>
            <div className="date-seperator">
              <span>Today</span>
            </div>
            <div className="sl-box">
              <div className="sl-box-header">
                <h5 className="sl-title">
                  fact_order
                  <span className="sl-box-badge badge-query">query</span>
                </h5>
                <div className="sl-box-tools">
                  <button className="btn btn-like liked">234</button>
                </div>
              </div>
              <div className="sl-box-body">
                <p>
                  <strong>Tags:</strong>
                  <span className="sl-box-tag">Dispatch</span>
                  <span className="sl-box-tag">Health</span>
                  <span className="sl-box-tag">Market</span>
                </p>
                <p>
                  <strong>Last run:</strong>{' '}
                  <i>Sanket on Jan 15, 2019 1:25pm</i> | <strong>1454</strong>{' '}
                  rows | <strong>15</strong> columns | 3 data type
                </p>
                <p>
                  <strong>5,432 Runs</strong> | Shared with{' '}
                  <strong>24 users</strong>
                  <a className="sl-box-link" href="#">
                    View recent runs
                  </a>
                </p>
              </div>
            </div>
            <div className="sl-box">
              <div className="sl-box-header">
                <h5 className="sl-title">
                  hourly_sales_figures
                  <span className="sl-box-badge badge-query">report</span>
                </h5>
                <div className="sl-box-tools">
                  <button className="btn btn-like">234</button>
                </div>
              </div>
              <div className="sl-box-body">
                <p>
                  <strong>Description:</strong> Report of hourly sales figures
                  in the market place
                </p>
                <p>
                  Owner: <strong>Shop Org</strong> | Time taken to run:{' '}
                  <strong>5mins 30secs</strong> | Cost: <strong>$45</strong>
                </p>
                <p className="sl-query">
                  <strong>Query:</strong>
                  <pre>
                    <span className="text-secondary">SELECT</span> *{' '}
                    <span className="text-secondary">FROM</span> Customers{' '}
                    <span className="text-secondary">WHERE</span> Country=
                    <span className="text-warning">Mexico</span>;
                  </pre>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-sm-6">
            <div className="mydata-summary">
              <div>
                <p>Tier</p>
                <span className="tier-badge">Tier 1</span>
              </div>
              <div>
                <p>Team</p>
                <strong>data_warehouse</strong>
              </div>
              <div>
                <p>Super Org</p>
                <strong>Data</strong>
              </div>
              <div>
                <p>Usage - 99.8th percentile</p>
                <strong>27,119 queries last week</strong>
              </div>
            </div>
            <div className="sl-box">
              <div className="sl-box-header">
                <h4 className="sl-title-big">Description</h4>
                <div className="sl-box-tools">
                  <button className="btn btn-like">234</button>
                </div>
              </div>
              <div className="sl-box-body">
                <p>
                  The orders table contains information about each order in your
                  store. Although this table is good for generating order lists
                  and joining with the customers table, use the sales table
                  instead for financial or other metrical tasks.
                </p>
              </div>
            </div>
          </div>
          <div className="col-sm-3">
            <div className="sl-box">
              <div className="sl-box-header">
                <h4 className="sl-title-big">Quality</h4>
              </div>
              <div className="sl-box-body p-0">
                <table className="table mb-0">
                  <tr>
                    <td>Freshness</td>
                    <th className="text-right">4h 2m</th>
                  </tr>
                  <tr>
                    <td>SLA</td>
                    <th className="text-right">4h 2m</th>
                  </tr>
                  <tr>
                    <td>Freshness</td>
                    <th className="text-right">Availability</th>
                  </tr>
                </table>
              </div>
            </div>
          </div>
          <div className="col-sm-3">
            <div className="sl-box">
              <div className="sl-box-header">
                <h4 className="sl-title-big">Related Table</h4>
              </div>
              <div className="sl-box-body p-0">
                <table className="table mb-0">
                  <tr>
                    <td>
                      <a href="#">dim_customer</a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <a href="#">dim_customer</a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <a href="#">dim_customer</a>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="clearfix mb-3">
          <div className="float-left">
            <h4 className="quality-title">Overall Quality</h4>
          </div>
          <div className="float-right">
            <button className="btn btn-outline-primary btn-sm">
              Add New Test
            </button>
          </div>
        </div>
        <div className="row">
          <div className="col-sm-4">
            <div className="sl-box">
              <div className="sl-box-header">
                <h4 className="sl-title-big">Freshness</h4>
              </div>
              <div className="sl-box-body">
                <p>
                  <strong>Last Runs:</strong>
                  <div className="last-runs">
                    <span className="bg-success">&nbsp;</span>
                    <span className="bg-success">&nbsp;</span>
                    <span className="bg-success">&nbsp;</span>
                    <span className="bg-success">&nbsp;</span>
                    <span className="bg-success">Success</span>
                  </div>
                </p>
                <p>
                  <strong>Last Results:</strong> June 21, 2020 05:00 AM
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="clearfix mb-3">
          <div className="float-left">
            <h5 className="quality-subtitle">Cross Data Consistancy Quality</h5>
          </div>
        </div>
        <div className="row">
          <div className="col-sm-12">
            <table className="table table-quality">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Latest Run</th>
                  <th>Latest Results</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>us-east-1a</td>
                  <td>
                    <div className="last-runs">
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">Success</span>
                    </div>
                  </td>
                  <td>June 21, 2020 05:00 AM</td>
                </tr>
                <tr>
                  <td>us-east-1a</td>
                  <td>
                    <div className="last-runs">
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">&nbsp;</span>
                      <span className="bg-success">Success</span>
                    </div>
                  </td>
                  <td>June 21, 2020 05:00 AM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="row">
          <div className="col-sm-12">
            <table className="table table-bordered table-data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Latest Run</th>
                  <th>Latest Results</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>us-east-1a</td>
                  <td>Test</td>
                  <td>June 21, 2020 05:00 AM</td>
                </tr>
                <tr>
                  <td>us-east-1a</td>
                  <td>Test</td>
                  <td>June 21, 2020 05:00 AM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default DummyPage;
