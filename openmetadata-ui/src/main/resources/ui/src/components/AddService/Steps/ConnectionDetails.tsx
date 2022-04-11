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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { DashboardServiceType } from '../../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../../generated/entity/services/messagingService';
import { requiredField } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import { ConnectionDetailsProps } from './Steps.interface';

const ConnectionDetails = ({
  serviceCategory,
  url,
  port,
  selectedService,
  database,
  username,
  password,
  warehouse,
  account,
  brokers,
  pipelineUrl,
  schemaRegistry,
  dashboardUrl,
  env,
  apiVersion,
  server,
  siteName,
  apiKey,
  handleValidation,
  connectionOptions,
  connectionArguments,
  addConnectionOptionFields,
  removeConnectionOptionFields,
  handleConnectionOptionFieldsChange,
  addConnectionArgumentFields,
  removeConnectionArgumentFields,
  handleConnectionArgumentFieldsChange,
  onBack,
  onSubmit,
}: ConnectionDetailsProps) => {
  const getBrokerUrlPlaceholder = (): string => {
    return selectedService === MessagingServiceType.Pulsar
      ? 'hostname:port'
      : 'hostname1:port1, hostname2:port2';
  };

  const getDatabaseFields = (): JSX.Element => {
    return (
      <>
        <div className="tw-mt-4 tw-grid tw-grid-cols-3 tw-gap-2 ">
          <div className="tw-col-span-2">
            <label className="tw-block tw-form-label" htmlFor="url">
              {requiredField('Host:')}
            </label>
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid="url"
              id="url"
              name="url"
              placeholder="hostname"
              type="text"
              value={url}
              onChange={handleValidation}
            />
            {/* {showErrorMsg.url && errorMsg('Host name is required')} */}
          </div>
          <div className="">
            <label className="tw-block tw-form-label" htmlFor="port">
              {requiredField('Port:')}
            </label>
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid="port"
              id="port"
              name="port"
              placeholder="port"
              type="text"
              value={port}
              onChange={handleValidation}
            />
            {/* {showErrorMsg.port && errorMsg('Port is required')} */}
          </div>
        </div>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="username">
            Username:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="username"
            id="username"
            name="username"
            placeholder="username"
            type="text"
            value={username}
            onChange={handleValidation}
          />
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="password">
            Password:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="password"
            id="password"
            name="password"
            placeholder="password"
            type="password"
            value={password}
            onChange={handleValidation}
          />
        </Field>

        <Field>
          <label className="tw-block tw-form-label" htmlFor="database">
            Database:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="database"
            id="database"
            name="database"
            placeholder="database name"
            type="text"
            value={database}
            onChange={handleValidation}
          />
        </Field>

        {/* optional filed for snowflik */}
        {selectedService === DatabaseServiceType.Snowflake && (
          <div className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-2">
            <div>
              <label className="tw-block tw-form-label" htmlFor="warehouse">
                Warehouse:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="warehouse"
                id="warehouse"
                name="warehouse"
                placeholder="Warehouse name"
                type="text"
                value={warehouse}
                onChange={handleValidation}
              />
            </div>

            <div>
              <label className="tw-block tw-form-label" htmlFor="account">
                Account:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="account"
                id="account"
                name="account"
                placeholder="Account name"
                type="text"
                value={account}
                onChange={handleValidation}
              />
            </div>
          </div>
        )}
        <div data-testid="connection-options">
          <div className="tw-flex tw-items-center tw-mt-6">
            <p className="w-form-label tw-mr-3">Connection Options</p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={addConnectionOptionFields}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </div>

          {connectionOptions.map((value, i) => (
            <div className="tw-flex tw-items-center" key={i}>
              <div className="tw-grid tw-grid-cols-2 tw-gap-x-2 tw-w-11/12">
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`option-key-${i}`}
                    name="key"
                    placeholder="Key"
                    type="text"
                    value={value.key}
                    onChange={(e) =>
                      handleConnectionOptionFieldsChange(
                        i,
                        'key',
                        e.target.value
                      )
                    }
                  />
                </Field>
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`option-value-${i}`}
                    name="value"
                    placeholder="Value"
                    type="text"
                    value={value.value}
                    onChange={(e) =>
                      handleConnectionOptionFieldsChange(
                        i,
                        'value',
                        e.target.value
                      )
                    }
                  />
                </Field>
              </div>
              <button
                className="focus:tw-outline-none tw-mt-3 tw-w-1/12"
                onClick={(e) => {
                  removeConnectionOptionFields(i);
                  e.preventDefault();
                }}>
                <SVGIcons
                  alt="delete"
                  icon="icon-delete"
                  title="Delete"
                  width="12px"
                />
              </button>
            </div>
          ))}
        </div>
        <div data-testid="connection-arguments">
          <div className="tw-flex tw-items-center tw-mt-6">
            <p className="w-form-label tw-mr-3">Connection Arguments</p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={addConnectionArgumentFields}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </div>
          {connectionArguments.map((value, i) => (
            <div className="tw-flex tw-items-center" key={i}>
              <div className="tw-grid tw-grid-cols-2 tw-gap-x-2 tw-w-11/12">
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`argument-key-${i}`}
                    name="key"
                    placeholder="Key"
                    type="text"
                    value={value.key}
                    onChange={(e) =>
                      handleConnectionArgumentFieldsChange(
                        i,
                        'key',
                        e.target.value
                      )
                    }
                  />
                </Field>
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`argument-value-${i}`}
                    name="value"
                    placeholder="Value"
                    type="text"
                    value={value.value}
                    onChange={(e) =>
                      handleConnectionArgumentFieldsChange(
                        i,
                        'value',
                        e.target.value
                      )
                    }
                  />
                </Field>
              </div>
              <button
                className="focus:tw-outline-none tw-mt-3 tw-w-1/12"
                onClick={(e) => {
                  removeConnectionArgumentFields(i);
                  e.preventDefault();
                }}>
                <SVGIcons
                  alt="delete"
                  icon="icon-delete"
                  title="Delete"
                  width="12px"
                />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  };

  const getMessagingFields = (): JSX.Element => {
    return (
      <>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="brokers">
            {requiredField('Broker Url:')}
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="brokers-url"
            id="brokers"
            name="brokers"
            placeholder={getBrokerUrlPlaceholder()}
            type="text"
            value={brokers}
            onChange={handleValidation}
          />
          {/* {showErrorMsg.broker && errorMsg('Broker url is required')} */}
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="schemaRegistry">
            Schema Registry:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="schema-registry"
            id="schemaRegistry"
            name="schemaRegistry"
            placeholder="http(s)://hostname:port"
            type="text"
            value={schemaRegistry}
            onChange={handleValidation}
          />
        </Field>
      </>
    );
  };

  const getDashboardFields = (): JSX.Element => {
    let elemFields: JSX.Element;
    switch (selectedService) {
      case DashboardServiceType.Redash: {
        elemFields = (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboardUrl">
                {requiredField('Dashboard Url:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="dashboardUrl"
                name="dashboardUrl"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.dashboardUrl && errorMsg('Url is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="apiKey">
                {requiredField('Api key:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="apiKey"
                name="apiKey"
                placeholder="api key"
                type="password"
                value={apiKey}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.apiKey && errorMsg('Api key is required')} */}
            </Field>
          </>
        );

        break;
      }
      case DashboardServiceType.Tableau: {
        elemFields = (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="siteName">
                {requiredField('Site Name:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="siteName"
                name="siteName"
                placeholder="site name"
                type="text"
                value={siteName}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.siteName && errorMsg('Site name is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboardUrl">
                {requiredField('Site Url:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="dashboardUrl"
                name="dashboardUrl"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.dashboardUrl && errorMsg('Site url is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="username">
                {requiredField('Username:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="username"
                name="username"
                placeholder="username"
                type="text"
                value={username}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.username && errorMsg('Username is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="password">
                {requiredField('Password:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="password"
                name="password"
                placeholder="password"
                type="password"
                value={password}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.password && errorMsg('Password is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="server">
                {requiredField('Server:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="server"
                name="server"
                placeholder="http(s)://hostname:port"
                type="text"
                value={server}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.server && errorMsg('Server is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="apiVersion">
                {requiredField('Api Version:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="api-version"
                id="apiVersion"
                name="apiVersion"
                placeholder="api version"
                type="text"
                value={apiVersion}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.apiVersion && errorMsg('Api version is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="env">
                Environment:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="env"
                name="env"
                placeholder="environment"
                type="text"
                value={env}
                onChange={handleValidation}
              />
            </Field>
          </>
        );

        break;
      }
      default: {
        elemFields = (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboard-url">
                {requiredField('Dashboard Url:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="dashboard-url"
                id="dashboard-url"
                name="dashboard-url"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.dashboardUrl &&
                errorMsg('Dashboard url is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="username">
                {requiredField('Username:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="username"
                id="username"
                name="username"
                placeholder="username"
                type="text"
                value={username}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.username && errorMsg('Username is required')} */}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="password">
                {requiredField('Password:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="password"
                id="password"
                name="password"
                placeholder="password"
                type="password"
                value={password}
                onChange={handleValidation}
              />
              {/* {showErrorMsg.password && errorMsg('Password is required')} */}
            </Field>
          </>
        );

        break;
      }
    }

    return elemFields;
  };

  const getPipelineFields = (): JSX.Element => {
    return (
      <Field>
        <label className="tw-block tw-form-label" htmlFor="pipelineUrl">
          {requiredField('Pipeline Url:')}
        </label>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="pipeline-url"
          id="pipelineUrl"
          name="pipelineUrl"
          placeholder="http(s)://hostname:port"
          type="text"
          value={pipelineUrl}
          onChange={handleValidation}
        />
        {/* {showErrorMsg.pipelineUrl && errorMsg('Url is required')} */}
      </Field>
    );
  };

  const getOptionalFields = (): JSX.Element => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return getDatabaseFields();
      case ServiceCategory.MESSAGING_SERVICES:
        return getMessagingFields();
      case ServiceCategory.DASHBOARD_SERVICES:
        return getDashboardFields();
      case ServiceCategory.PIPELINE_SERVICES:
        return getPipelineFields();
      default:
        return <></>;
    }
  };

  return (
    <div>
      {getOptionalFields()}
      <Field className="tw-flex tw-justify-end tw-mt-10">
        <Button
          className="tw-mr-2"
          data-testid="previous-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onBack}>
          <span>Back</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={onSubmit}>
          <span>Submit</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConnectionDetails;
