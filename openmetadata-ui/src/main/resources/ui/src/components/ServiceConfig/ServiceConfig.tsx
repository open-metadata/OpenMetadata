import { isEqual } from 'lodash';
import { ServicesData } from 'Models';
import React, { useState } from 'react';
import { ONLY_NUMBER_REGEX } from '../../constants/constants';
import {
  // DashboardServiceType,
  // MessagingServiceType,
  ServiceCategory,
} from '../../enums/service.enum';
import { DashboardServiceType } from '../../generated/entity/services/dashboardService';
import { MessagingServiceType } from '../../generated/entity/services/messagingService';
import useToastContext from '../../hooks/useToastContext';
import { errorMsg, requiredField } from '../../utils/CommonUtils';
import {
  getHostPortDetails,
  getKeyValueObject,
  getKeyValuePair,
} from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Loader from '../Loader/Loader';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface ServiceConfigProps {
  serviceCategory: ServiceCategory;
  data?: ServicesData;
  handleUpdate: (data: ServicesData) => Promise<void>;
}

type ErrorMsg = {
  selectService: boolean;
  name: boolean;
  host?: boolean;
  port?: boolean;
  driverClass?: boolean;
  broker?: boolean;
  dashboardUrl?: boolean;
  username?: boolean;
  password?: boolean;
  apiKey?: boolean;
  siteName?: boolean;
  apiVersion?: boolean;
  server?: boolean;
  pipelineUrl?: boolean;
};

type DynamicFormFieldType = {
  key: string;
  value: string;
};

export const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const ServiceConfig = ({
  serviceCategory,
  data,
  handleUpdate,
}: ServiceConfigProps) => {
  const showToast = useToastContext();
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'initial' | 'waiting' | 'success'>(
    'initial'
  );
  const [showErrorMsg, setShowErrorMsg] = useState<ErrorMsg>({
    selectService: false,
    name: false,
    host: false,
    port: false,
    driverClass: false,
    broker: false,
    dashboardUrl: false,
    username: false,
    password: false,
    apiKey: false,
    siteName: false,
    apiVersion: false,
    server: false,
    pipelineUrl: false,
  });

  const [hostport] = useState(
    getHostPortDetails(data?.databaseConnection?.hostPort || '')
  );
  const [host, setHost] = useState(hostport.host);
  const [port, setPort] = useState(hostport.port);
  const [username, setUsername] = useState(
    serviceCategory === ServiceCategory.DATABASE_SERVICES
      ? data?.databaseConnection?.username || ''
      : data?.username || ''
  );
  const [password, setPassword] = useState(
    serviceCategory === ServiceCategory.DATABASE_SERVICES
      ? data?.databaseConnection?.password || ''
      : data?.password || ''
  );
  const [database, setDatabase] = useState(
    data?.databaseConnection?.database || ''
  );
  const [connectionOptions, setConnectionOptions] = useState<
    DynamicFormFieldType[]
  >(getKeyValuePair(data?.databaseConnection?.connectionOptions || {}) || []);

  const [connectionArguments, setConnectionArguments] = useState<
    DynamicFormFieldType[]
  >(getKeyValuePair(data?.databaseConnection?.connectionArguments || {}) || []);

  const [brokers, setBrokers] = useState(
    data?.brokers?.length ? data.brokers.join(', ') : ''
  );
  const [schemaRegistry, setSchemaRegistry] = useState(
    data?.schemaRegistry || ''
  );

  const [dashboardUrl, setDashboardUrl] = useState(data?.dashboardUrl || '');
  const [apiKey, setApiKey] = useState(data?.api_key || '');
  const [siteName, setSiteName] = useState(data?.site_name || '');
  const [apiVersion, setApiVersion] = useState(data?.api_version || '');
  const [server, setServer] = useState(data?.server || '');
  const [env, setEnv] = useState(data?.env || '');

  const getBrokerUrlPlaceholder = (): string => {
    return data?.serviceType === MessagingServiceType.Pulsar
      ? 'hostname:port'
      : 'hostname1:port1, hostname2:port2';
  };

  const [pipelineUrl, setPipelineUrl] = useState(data?.pipelineUrl || '');

  const handleCancel = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        setHost(hostport.host);
        setPort(hostport.port);
        setUsername(data?.databaseConnection?.username || '');
        setPassword(data?.databaseConnection?.password || '');
        setDatabase(data?.databaseConnection?.database || '');
        setConnectionOptions(
          getKeyValuePair(data?.databaseConnection?.connectionOptions || {}) ||
            []
        );
        setConnectionArguments(
          getKeyValuePair(
            data?.databaseConnection?.connectionArguments || {}
          ) || []
        );

        setShowErrorMsg({
          ...showErrorMsg,
          host: false,
          port: false,
        });

        break;
      case ServiceCategory.MESSAGING_SERVICES:
        setBrokers(data?.brokers?.length ? data.brokers.join(', ') : '');
        setSchemaRegistry(data?.schemaRegistry || '');
        setShowErrorMsg({
          ...showErrorMsg,
          broker: false,
        });

        break;
      case ServiceCategory.DASHBOARD_SERVICES:
        setUsername(data?.username || '');
        setPassword(data?.password || '');
        setDashboardUrl(data?.dashboardUrl || '');
        setApiKey(data?.api_key || '');
        setSiteName(data?.site_name || '');
        setApiVersion(data?.api_version || '');
        setServer(data?.server || '');
        setEnv(data?.env || '');

        setShowErrorMsg({
          ...showErrorMsg,
          dashboardUrl: false,
          siteName: false,
          username: false,
          password: false,
          server: false,
          apiVersion: false,
          apiKey: false,
        });

        break;
      case ServiceCategory.PIPELINE_SERVICES:
        setPipelineUrl(data?.pipelineUrl || '');

        setShowErrorMsg({
          ...showErrorMsg,
          pipelineUrl: false,
        });

        break;
      default:
        break;
    }
  };

  const handleRequiredFiedError = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        setShowErrorMsg({
          ...showErrorMsg,
          host: !host,
          port: !port,
        });

        return Boolean(host && port);
      case ServiceCategory.MESSAGING_SERVICES:
        setShowErrorMsg({
          ...showErrorMsg,
          broker: !brokers,
        });

        return Boolean(brokers);

      case ServiceCategory.DASHBOARD_SERVICES: {
        switch (data?.serviceType) {
          case DashboardServiceType.Redash:
            setShowErrorMsg({
              ...showErrorMsg,
              dashboardUrl: !dashboardUrl,
              apiKey: !apiKey,
            });

            return Boolean(dashboardUrl && apiKey);

          case DashboardServiceType.Tableau:
            setShowErrorMsg({
              ...showErrorMsg,
              dashboardUrl: !dashboardUrl,
              siteName: !siteName,
              username: !username,
              password: !password,
              server: !server,
              apiVersion: !apiVersion,
            });

            return Boolean(
              siteName &&
                dashboardUrl &&
                username &&
                password &&
                server &&
                apiVersion
            );

          default:
            setShowErrorMsg({
              ...showErrorMsg,
              dashboardUrl: !dashboardUrl,
              username: !username,
              password: !password,
            });

            return Boolean(dashboardUrl && username && password);
        }
      }

      case ServiceCategory.PIPELINE_SERVICES:
        setShowErrorMsg({
          ...showErrorMsg,
          pipelineUrl: !pipelineUrl,
        });

        return Boolean(pipelineUrl);
      default:
        return true;
    }
  };

  const getUpdatedData = (): ServicesData => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return {
          ...data,
          databaseConnection: {
            hostPort: `${host}:${port}`,
            connectionArguments: getKeyValueObject(connectionArguments),
            connectionOptions: getKeyValueObject(connectionOptions),
            database: database,
            password: password,
            username: username,
          },
        };
      case ServiceCategory.MESSAGING_SERVICES:
        return {
          ...data,
          brokers:
            data?.serviceType === MessagingServiceType.Pulsar
              ? [brokers]
              : brokers.split(',').map((broker) => broker.trim()),
          schemaRegistry: schemaRegistry,
        };
      case ServiceCategory.DASHBOARD_SERVICES: {
        switch (data?.serviceType) {
          case DashboardServiceType.Redash:
            return {
              ...data,
              dashboardUrl: dashboardUrl,
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_key: apiKey,
            };

          case DashboardServiceType.Tableau:
            return {
              ...data,
              dashboardUrl: dashboardUrl,
              // eslint-disable-next-line @typescript-eslint/camelcase
              site_name: siteName,
              username: username,
              password: password,
              // eslint-disable-next-line @typescript-eslint/camelcase
              api_version: apiVersion,
              server: server,
            };

          default:
            return {
              ...data,
              dashboardUrl: dashboardUrl,
              username: username,
              password: password,
            };
        }
      }
      case ServiceCategory.PIPELINE_SERVICES:
        return {
          ...data,
          pipelineUrl: pipelineUrl,
        };
      default:
        return {};
    }
  };

  const handleSave = () => {
    const isValid = handleRequiredFiedError();

    if (isValid) {
      const updatedData: ServicesData = getUpdatedData();

      if (!isEqual(data, updatedData)) {
        setLoading(true);
        setStatus('waiting');

        handleUpdate(updatedData)
          .then(() => {
            setStatus('initial');
            setLoading(false);
          })
          .catch(() => {
            showToast({
              variant: 'error',
              body: `Error while updating service`,
            });
          });
      }
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const name = event.target.name;

    switch (name) {
      case 'broker':
        setBrokers(value);

        break;
      case 'dashboardUrl':
        setDashboardUrl(value);

        break;
      case 'apiKey':
        setApiKey(value);

        break;
      case 'siteName':
        setSiteName(value);

        break;
      case 'server':
        setServer(value);

        break;
      case 'apiVersion':
        setApiVersion(value);

        break;
      case 'host':
        setHost(value);

        break;
      case 'schemaRegistry':
        setSchemaRegistry(value);

        break;
      case 'username':
        setUsername(value);

        break;
      case 'password':
        setPassword(value);

        break;
      case 'database':
        setDatabase(value);

        break;
      case 'pipelineUrl':
        setPipelineUrl(value);

        break;

      case 'port':
        if (ONLY_NUMBER_REGEX.test(value) || value === '') {
          setPort(value);
        }

        break;

      default:
        break;
    }

    setShowErrorMsg({ ...showErrorMsg, [name]: false });
  };

  const addConnectionOptionFields = () => {
    setConnectionOptions([...connectionOptions, { key: '', value: '' }]);
  };

  const removeConnectionOptionFields = (i: number) => {
    const newFormValues = [...connectionOptions];
    newFormValues.splice(i, 1);
    setConnectionOptions(newFormValues);
  };

  const handleConnectionOptionFieldsChange = (
    i: number,
    field: keyof DynamicFormFieldType,
    value: string
  ) => {
    const newFormValues = [...connectionOptions];
    newFormValues[i][field] = value;
    setConnectionOptions(newFormValues);
  };

  const addConnectionArgumentFields = () => {
    setConnectionArguments([...connectionArguments, { key: '', value: '' }]);
  };

  const removeConnectionArgumentFields = (i: number) => {
    const newFormValues = [...connectionArguments];
    newFormValues.splice(i, 1);
    setConnectionArguments(newFormValues);
  };

  const handleConnectionArgumentFieldsChange = (
    i: number,
    field: keyof DynamicFormFieldType,
    value: string
  ) => {
    const newFormValues = [...connectionArguments];
    newFormValues[i][field] = value;
    setConnectionArguments(newFormValues);
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
              data-testid="host"
              id="host"
              name="host"
              placeholder="hostname"
              type="text"
              value={host}
              onChange={handleValidation}
            />
            {showErrorMsg.host && errorMsg('Host name is required')}
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
            {showErrorMsg.port && errorMsg('Port is required')}
          </div>
        </div>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="username">
            Username:
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
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="password">
            Password:
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

        <div>
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
        <div>
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
          <label className="tw-block tw-form-label" htmlFor="broker">
            {requiredField('Broker Url:')}
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="broker-url"
            id="broker"
            name="broker"
            placeholder={getBrokerUrlPlaceholder()}
            type="text"
            value={brokers}
            onChange={handleValidation}
          />
          {showErrorMsg.broker && errorMsg('Broker url is required')}
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="schema-registry">
            Schema Registry:{' '}
            {data?.schemaRegistry && (
              <a
                className="link-text tw-ml-1"
                href={data.schemaRegistry}
                rel="noopener noreferrer"
                target="_blank">
                <SVGIcons
                  alt="external-link"
                  className="tw-align-middle"
                  icon="external-link"
                  width="12px"
                />
              </a>
            )}
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="schema-registry"
            id="schema-registry"
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
    switch (data?.serviceType) {
      case DashboardServiceType.Redash: {
        elemFields = (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboardUrl">
                {requiredField('Dashboard Url:')}
                {data?.dashboardUrl && (
                  <a
                    className="link-text tw-ml-1"
                    href={data.dashboardUrl}
                    rel="noopener noreferrer"
                    target="_blank">
                    <SVGIcons
                      alt="external-link"
                      className="tw-align-middle"
                      icon="external-link"
                      width="12px"
                    />
                  </a>
                )}
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
              {showErrorMsg.dashboardUrl && errorMsg('Url is required')}
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
              {showErrorMsg.apiKey && errorMsg('Api key is required')}
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
              {showErrorMsg.siteName && errorMsg('Site name is required')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboard-url">
                {requiredField('Site Url:')}{' '}
                {data?.dashboardUrl && (
                  <a
                    className="link-text tw-ml-1"
                    href={data.dashboardUrl}
                    rel="noopener noreferrer"
                    target="_blank">
                    <SVGIcons
                      alt="external-link"
                      className="tw-align-middle"
                      icon="external-link"
                      width="12px"
                    />
                  </a>
                )}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="dashboard-url"
                name="dashboardUrl"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={handleValidation}
              />
              {showErrorMsg.dashboardUrl && errorMsg('Site url is required')}
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
              {showErrorMsg.username && errorMsg('Username is required')}
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
              {showErrorMsg.password && errorMsg('Password is required')}
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
              {showErrorMsg.server && errorMsg('Server is required')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="apiVersion">
                {requiredField('Api Version:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="apiVersion"
                name="apiVersion"
                placeholder="api version"
                type="text"
                value={apiVersion}
                onChange={handleValidation}
              />
              {showErrorMsg.apiVersion && errorMsg('Api version is required')}
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
                onChange={(e) => setEnv(e.target.value)}
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
              <label className="tw-block tw-form-label" htmlFor="dashboardUrl">
                {requiredField('Dashboard Url:')}
                {data?.dashboardUrl && (
                  <a
                    className="link-text tw-ml-1"
                    href={data.dashboardUrl}
                    rel="noopener noreferrer"
                    target="_blank">
                    <SVGIcons
                      alt="external-link"
                      className="tw-align-middle"
                      icon="external-link"
                      width="12px"
                    />
                  </a>
                )}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="dashboardUrl"
                id="dashboardUrl"
                name="dashboardUrl"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={handleValidation}
              />
              {showErrorMsg.dashboardUrl &&
                errorMsg('Dashboard url is required')}
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
              {showErrorMsg.username && errorMsg('Username is required')}
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
              {showErrorMsg.password && errorMsg('Password is required')}
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
          {data?.pipelineUrl && (
            <a
              className="link-text tw-ml-1"
              href={data.pipelineUrl}
              rel="noopener noreferrer"
              target="_blank">
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="12px"
              />
            </a>
          )}
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
        {showErrorMsg.pipelineUrl && errorMsg('Url is required')}
      </Field>
    );
  };

  const getDynamicFields = () => {
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
    <div className="tw-bg-white tw-h-full">
      <div
        className="tw-max-w-xl tw-mx-auto tw-pb-6"
        data-testid="service-config"
        id="serviceConfig">
        <form className="tw-w-screen-sm" data-testid="form">
          <div className="tw-px-4 tw-pt-3 tw-mx-auto">{getDynamicFields()}</div>
        </form>
        <div className="tw-mt-6 tw-text-right" data-testid="buttons">
          <Button
            size="regular"
            theme="primary"
            variant="text"
            onClick={handleCancel}>
            Discard
          </Button>
          {loading ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <Loader size="small" type="white" />
            </Button>
          ) : status === 'success' ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <FontAwesomeIcon icon="check" />
            </Button>
          ) : (
            <Button
              className="tw-w-16 tw-h-10"
              data-testid="saveManageTab"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={handleSave}>
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceConfig;
