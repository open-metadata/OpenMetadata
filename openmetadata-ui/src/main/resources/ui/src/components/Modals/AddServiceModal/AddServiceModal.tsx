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

import classNames from 'classnames';
import cronstrue from 'cronstrue';
import { isEmpty, isUndefined } from 'lodash';
import {
  DynamicFormFieldType,
  DynamicObj,
  EditorContentRef,
  ServiceTypes,
  StepperStepType,
} from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ONLY_NUMBER_REGEX } from '../../../constants/constants';
import { serviceTypes } from '../../../constants/services.const';
import {
  // DashboardServiceType,
  // MessagingServiceType,
  ServiceCategory,
} from '../../../enums/service.enum';
import {
  CreateAirflowPipeline,
  Schema,
} from '../../../generated/api/operations/pipelines/createAirflowPipeline';
import { DashboardServiceType } from '../../../generated/entity/services/dashboardService';
// import { DashboardService } from '../../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../../generated/entity/services/databaseService';
import {
  MessagingService,
  MessagingServiceType,
} from '../../../generated/entity/services/messagingService';
import { PipelineService } from '../../../generated/entity/services/pipelineService';
import { PipelineType } from '../../../generated/operations/pipelines/airflowPipeline';
import {
  errorMsg,
  getCurrentDate,
  getCurrentUserId,
  getSeparator,
  getServiceLogo,
  requiredField,
  restrictFormSubmit,
} from '../../../utils/CommonUtils';
import {
  getAirflowPipelineTypes,
  getIsIngestionEnable,
  getKeyValueObject,
  getKeyValuePair,
} from '../../../utils/ServiceUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
// import { fromISOString } from '../../../utils/ServiceUtils';
import { Button } from '../../buttons/Button/Button';
import CronEditor from '../../common/CronEditor/CronEditor';
import MarkdownWithPreview from '../../common/editor/MarkdownWithPreview';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import IngestionStepper from '../../IngestionStepper/IngestionStepper.component';
// import { serviceType } from '../../../constants/services.const';

export type DataObj = {
  id?: string;
  description: string | undefined;
  ingestionSchedule?:
    | {
        repeatFrequency: string;
        startDate: string;
      }
    | undefined;
  name: string;
  serviceType: string;
  databaseConnection?: {
    hostPort: string;
    password: string;
    username: string;
    database: string;
    connectionArguments: DynamicObj;
    connectionOptions: DynamicObj;
  };
  brokers?: Array<string>;
  schemaRegistry?: string;
  dashboardUrl?: string;
  username?: string;
  password?: string;
  url?: string;
  api_key?: string;
  site_name?: string;
  api_version?: string;
  server?: string;
  env?: string;
  pipelineUrl?: string;
};

// type DataObj = CreateDatabaseService &
//   Partial<CreateMessagingService> &
//   Partial<CreateDashboardService>;

type DashboardService = {
  description: string;
  href: string;
  id: string;
  name: string;
  serviceType: string;
  ingestionSchedule?: { repeatFrequency: string; startDate: string };
  dashboardUrl?: string;
  username?: string;
  password?: string;
  url?: string;
  api_key?: string;
  site_name?: string;
  api_version?: string;
  server?: string;
  env?: string;
};

export type ServiceDataObj = { name: string } & Partial<DatabaseService> &
  Partial<MessagingService> &
  Partial<DashboardService> &
  Partial<PipelineService>;

export type EditObj = {
  edit: boolean;
  id?: string;
};

type Props = {
  header: string;
  serviceName: ServiceTypes;
  serviceList: Array<ServiceDataObj>;
  // data?: ServiceDataObj; // until databaseService interface is not generating from Schema
  data?: DataObj;
  onSave: (
    obj: DataObj,
    text: string,
    editData: EditObj,
    ingestionList?: CreateAirflowPipeline[]
  ) => void;
  onCancel: () => void;
};

type ErrorMsg = {
  selectService: boolean;
  name: boolean;
  url?: boolean;
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

type IngestionListType = {
  showError: boolean;
  type: string;
  ingestionName: string;
  tableFilterPattern: {
    includePattern: string;
    excludePattern: string;
  };
  schemaFilterPattern: {
    includePattern: string;
    excludePattern: string;
  };
  isIngestionActive: boolean;
  includeView: boolean;
  enableDataProfiler: boolean;
  ingestSampleData: boolean;
  repeatFrequency: string;
  startDate: string;
  endDate: string;
  id: number;
};

const STEPS_FOR_DATABASE_SERVICE: Array<StepperStepType> = [
  { name: 'Select Service Type', step: 1 },
  { name: 'Configure Service', step: 2 },
  { name: 'Connection Details', step: 3 },
  { name: 'Ingestion Details', step: 4 },
  { name: 'Review & Submit', step: 5 },
];

const STEPS_FOR_OTHER_SERVICE: Array<StepperStepType> = [
  { name: 'Select Service Type', step: 1 },
  { name: 'Configure Service', step: 2 },
  { name: 'Connection Details', step: 3 },
  { name: 'Review & Submit', step: 5 },
];

export const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const generateName = (data: Array<ServiceDataObj>) => {
  const newArr: string[] = [];
  data.forEach((d) => {
    newArr.push(d.name);
  });

  return newArr;
};

const PreviewSection = ({
  header,
  data,
  className,
}: {
  header: string;
  data: Array<{ key: string; value: string | ReactNode }>;
  className: string;
}) => {
  return (
    <div className={className}>
      <p className="tw-font-medium tw-px-1 tw-mb-2">{header}</p>
      <div className="tw-grid tw-gap-4 tw-grid-cols-2 tw-place-content-center tw-pl-6">
        {data.map((d, i) => (
          <div key={i}>
            <div className="tw-text-xs tw-font-normal tw-text-grey-muted">
              {d.key}
            </div>
            <div>{d.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const INGESTION_SCHEDULER_INITIAL_VALUE = '5 * * * *';

export const AddServiceModal: FunctionComponent<Props> = ({
  header,
  serviceName,
  data,
  onSave,
  onCancel,
  serviceList,
}: Props) => {
  const [isIngestionEnable] = useState(
    getIsIngestionEnable(serviceName as ServiceCategory)
  );
  const [steps] = useState<Array<StepperStepType>>(
    isIngestionEnable ? STEPS_FOR_DATABASE_SERVICE : STEPS_FOR_OTHER_SERVICE
  );
  const [editData] = useState({ edit: !!data, id: data?.id });
  const [serviceType, setServiceType] = useState(
    serviceTypes[serviceName] || []
  );
  const [existingNames] = useState(generateName(serviceList));
  const [selectService, setSelectService] = useState(data?.serviceType || '');
  const [name, setName] = useState(data?.name || '');
  const [url, setUrl] = useState(
    data?.databaseConnection?.hostPort.split(':')[0] || ''
  );
  const [port, setPort] = useState(
    data?.databaseConnection?.hostPort.split(':')[1] || ''
  );
  const [database, setDatabase] = useState(
    data?.databaseConnection?.database || ''
  );
  const [brokers, setBrokers] = useState(
    data?.brokers?.length ? data.brokers.join(', ') : ''
  );
  const [schemaRegistry, setSchemaRegistry] = useState(
    data?.schemaRegistry || ''
  );
  const [dashboardUrl, setDashboardUrl] = useState(data?.dashboardUrl || '');
  const [username, setUsername] = useState(
    serviceName === ServiceCategory.DATABASE_SERVICES
      ? data?.databaseConnection?.username || ''
      : data?.username || ''
  );
  const [password, setPassword] = useState(
    serviceName === ServiceCategory.DATABASE_SERVICES
      ? data?.databaseConnection?.password || ''
      : data?.password || ''
  );
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [apiKey, setApiKey] = useState(data?.api_key || '');
  const [isApiKeyVisible, setisApiKeyVisible] = useState(false);
  const [siteName, setSiteName] = useState(data?.site_name || '');
  const [apiVersion, setApiVersion] = useState(data?.api_version || '');
  const [server, setServer] = useState(data?.server || '');
  const [env, setEnv] = useState(data?.env || '');
  const [pipelineUrl, setPipelineUrl] = useState(data?.pipelineUrl || '');
  const [showErrorMsg, setShowErrorMsg] = useState<ErrorMsg>({
    selectService: false,
    name: false,
    url: false,
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

  const [description, setdescription] = useState(data?.description || '');
  const [sameNameError, setSameNameError] = useState(false);
  const [activeStepperStep, setActiveStepperStep] = useState(data ? 2 : 1);
  const [ingestionTypeList, setIngestionTypeList] =
    useState<Array<IngestionListType>>();
  const [selectedIngestionType, setSelectedIngestionType] = useState<
    number | undefined
  >();
  const [connectionOptions, setConnectionOptions] = useState<
    DynamicFormFieldType[]
  >(getKeyValuePair(data?.databaseConnection?.connectionOptions || {}) || []);

  const [connectionArguments, setConnectionArguments] = useState<
    DynamicFormFieldType[]
  >(getKeyValuePair(data?.databaseConnection?.connectionArguments || {}) || []);

  const markdownRef = useRef<EditorContentRef>();

  const getBrokerUrlPlaceholder = (): string => {
    return selectService === MessagingServiceType.Pulsar
      ? 'hostname:port'
      : 'hostname1:port1, hostname2:port2';
  };

  const isServiceNameExists = () => {
    const isExists = existingNames.includes(name.trim());
    setSameNameError(isExists);

    return isExists;
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const name = event.target.name;

    switch (name) {
      case 'selectService':
        setSelectService(value);

        break;

      case 'name':
        setName(value);
        setIngestionTypeList(
          ingestionTypeList?.map((d) => {
            return {
              ...d,
              ingestionName: `${value.trim().replace(/\s+/g, '_')}_${
                PipelineType.Metadata
              }`,
            };
          })
        );

        break;

      case 'url':
        setUrl(value);

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

  const handleServiceClick = (service: string) => {
    setShowErrorMsg({
      ...showErrorMsg,
      selectService: false,
    });
    setSelectService(service);
    if (isIngestionEnable) {
      const ingestionTypes = getAirflowPipelineTypes(service, true) || [];
      const ingestionScheduleList: IngestionListType[] = [];

      ingestionTypes.forEach((s, i) => {
        ingestionScheduleList.push({
          showError: false,
          type: s,
          ingestionName: name || '',
          includeView: true,
          enableDataProfiler: false,
          ingestSampleData: false,
          tableFilterPattern: {
            includePattern: '',
            excludePattern: '',
          },
          schemaFilterPattern: {
            includePattern: '',
            excludePattern: '',
          },
          isIngestionActive: true,
          repeatFrequency: INGESTION_SCHEDULER_INITIAL_VALUE,
          startDate: getCurrentDate(),
          endDate: '',
          id: i + 1,
        });
      });

      setIngestionTypeList(ingestionScheduleList);
    }
  };

  const handleSave = () => {
    let dataObj: DataObj = {
      description: description,
      name: name,
      serviceType: selectService,
    };

    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        {
          dataObj = {
            ...dataObj,
            databaseConnection: {
              hostPort: `${url}:${port}`,
              connectionArguments: getKeyValueObject(connectionArguments),
              connectionOptions: getKeyValueObject(connectionOptions),
              database: database,
              password: password,
              username: username,
            },
          };
        }

        break;
      case ServiceCategory.MESSAGING_SERVICES:
        {
          dataObj = {
            ...dataObj,
            brokers:
              selectService === MessagingServiceType.Pulsar
                ? [brokers]
                : brokers.split(',').map((broker) => broker.trim()),
            schemaRegistry: schemaRegistry,
          };
        }

        break;
      case ServiceCategory.DASHBOARD_SERVICES:
        {
          switch (selectService) {
            case DashboardServiceType.Redash:
              {
                dataObj = {
                  ...dataObj,
                  dashboardUrl: dashboardUrl,
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  api_key: apiKey,
                };
              }

              break;
            case DashboardServiceType.Tableau:
              {
                dataObj = {
                  ...dataObj,
                  dashboardUrl: dashboardUrl,
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  site_name: siteName,
                  username: username,
                  password: password,
                  // eslint-disable-next-line @typescript-eslint/camelcase
                  api_version: apiVersion,
                  server: server,
                };
              }

              break;
            default:
              {
                dataObj = {
                  ...dataObj,
                  dashboardUrl: dashboardUrl,
                  username: username,
                  password: password,
                };
              }

              break;
          }
        }

        break;
      case ServiceCategory.PIPELINE_SERVICES:
        {
          dataObj = {
            ...dataObj,
            pipelineUrl: pipelineUrl,
          };
        }

        break;
      default:
        break;
    }

    const ingestionDetails: CreateAirflowPipeline[] =
      isIngestionEnable && ingestionTypeList
        ? ingestionTypeList.reduce((obj, value) => {
            if (value.isIngestionActive) {
              const schemaIncludePattern =
                value.schemaFilterPattern.includePattern;
              const schemaExcludePattern =
                value.schemaFilterPattern.excludePattern;
              const tableIncludePattern =
                value.tableFilterPattern.includePattern;
              const tableExcludePattern =
                value.tableFilterPattern.excludePattern;

              const ingestionObj = {
                name: value.ingestionName,
                pipelineConfig: {
                  schema: Schema.DatabaseServiceMetadataPipeline,
                  config: {
                    includeViews: value.includeView,
                    generateSampleData: value.ingestSampleData,
                    enableDataProfiler: value.enableDataProfiler,
                    schemaFilterPattern:
                      !isEmpty(schemaIncludePattern) ||
                      !isEmpty(schemaExcludePattern)
                        ? {
                            includes: !isEmpty(schemaIncludePattern)
                              ? value.schemaFilterPattern.includePattern.split(
                                  ','
                                )
                              : undefined,
                            excludes: !isEmpty(schemaExcludePattern)
                              ? value.schemaFilterPattern.excludePattern.split(
                                  ','
                                )
                              : undefined,
                          }
                        : undefined,
                    tableFilterPattern:
                      !isEmpty(tableIncludePattern) ||
                      !isEmpty(tableExcludePattern)
                        ? {
                            includes: !isEmpty(tableIncludePattern)
                              ? value.tableFilterPattern.includePattern.split(
                                  ','
                                )
                              : undefined,
                            excludes: !isEmpty(tableExcludePattern)
                              ? value.tableFilterPattern.excludePattern.split(
                                  ','
                                )
                              : undefined,
                          }
                        : undefined,
                  },
                },
                service: {
                  type: 'databaseService',
                  id: '',
                },
                owner: {
                  id: getCurrentUserId(),
                  type: 'user',
                },
                scheduleInterval: value.repeatFrequency,
                startDate: value.startDate as unknown as Date,
                endDate: value.endDate as unknown as Date,
                forceDeploy: true,
              };

              return [...obj, ingestionObj];
            }

            return obj;
          }, [] as CreateAirflowPipeline[])
        : [];

    onSave(dataObj, serviceName, editData, ingestionDetails);
  };

  const handleErrorForAdditionalField = () => {
    let setMsg: ErrorMsg = {
      selectService: !selectService,
      name: !name.trim(),
    };
    let isValid = true;
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        {
          const updateUrl = url.trim();
          const updatedPort = port.trim();

          setMsg = {
            ...setMsg,
            url: !updateUrl,
            port: !updatedPort,
          };
          setUrl(updateUrl);
          setPort(updatedPort);
          isValid = Boolean(updateUrl && updatedPort);
        }

        break;
      case ServiceCategory.MESSAGING_SERVICES:
        {
          const updatedBrokers = brokers.trim();
          setMsg = {
            ...setMsg,
            broker: !updatedBrokers,
          };
          setBrokers(updatedBrokers);
          isValid = Boolean(updatedBrokers);
        }

        break;
      case ServiceCategory.DASHBOARD_SERVICES:
        {
          switch (selectService) {
            case DashboardServiceType.Redash:
              {
                const updatedUrl = dashboardUrl.trim();
                const updatedKey = apiKey.trim();
                setMsg = {
                  ...setMsg,
                  dashboardUrl: !updatedUrl,
                  apiKey: !updatedKey,
                };
                setDashboardUrl(updatedUrl);
                setApiKey(updatedKey);
                isValid = Boolean(updatedUrl && updatedKey);
              }

              break;
            case DashboardServiceType.Tableau:
              {
                const updatedUrl = dashboardUrl.trim();
                const updatedSiteName = siteName.trim();
                const updatedPassword = password.trim();
                const updatedUsername = username.trim();
                const updatedApiVersion = apiVersion.trim();
                const updatedServer = server.trim();

                setMsg = {
                  ...setMsg,
                  dashboardUrl: !updatedUrl,
                  siteName: !updatedSiteName,
                  username: !updatedUsername,
                  password: !updatedPassword,
                  apiVersion: !updatedApiVersion,
                  server: !server,
                };

                setDashboardUrl(updatedUrl);
                setSiteName(updatedSiteName);
                setPassword(updatedPassword);
                setUsername(updatedUsername);
                setApiVersion(updatedApiVersion);
                setServer(updatedServer);

                isValid = Boolean(
                  updatedUrl &&
                    updatedSiteName &&
                    updatedUsername &&
                    updatedPassword &&
                    updatedApiVersion &&
                    updatedServer
                );
              }

              break;
            default:
              {
                const updatedUrl = dashboardUrl.trim();
                const updatedPassword = password.trim();
                const updatedUsername = username.trim();

                setMsg = {
                  ...setMsg,
                  dashboardUrl: !updatedUrl,
                  username: !updatedUsername,
                  password: !updatedPassword,
                };

                setDashboardUrl(updatedUrl);
                setPassword(updatedPassword);
                setUsername(updatedUsername);

                isValid = Boolean(
                  updatedUrl && updatedUsername && updatedPassword
                );
              }

              break;
          }
        }

        break;
      case ServiceCategory.PIPELINE_SERVICES:
        {
          const updatedPipelineUrl = pipelineUrl.trim();
          setMsg = {
            ...setMsg,
            pipelineUrl: !updatedPipelineUrl,
          };
          setPipelineUrl(updatedPipelineUrl);
          isValid = Boolean(updatedPipelineUrl);
        }

        break;
      default:
        break;
    }
    setShowErrorMsg(setMsg);

    return isValid;
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
              data-testid="url"
              id="url"
              name="url"
              placeholder="hostname"
              type="text"
              value={url}
              onChange={handleValidation}
            />
            {showErrorMsg.url && errorMsg('Host name is required')}
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
            data-testid="username"
            id="username"
            name="username"
            placeholder="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
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
            onChange={(e) => setDatabase(e.target.value)}
          />
        </Field>

        <div data-testid="connection-options">
          <div className="tw-flex tw-items-center tw-mt-6">
            <p className="w-form-label tw-mr-3">Connection Options</p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={addConnectionOptionFields}>
              <i aria-hidden="true" className="fa fa-plus" />
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
              <i aria-hidden="true" className="fa fa-plus" />
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
            onChange={(e) => setBrokers(e.target.value)}
          />
          {showErrorMsg.broker && errorMsg('Broker url is required')}
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="schema-registry">
            Schema Registry:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="schema-registry"
            id="schema-registry"
            name="schema-registry"
            placeholder="http(s)://hostname:port"
            type="text"
            value={schemaRegistry}
            onChange={(e) => setSchemaRegistry(e.target.value)}
          />
        </Field>
      </>
    );
  };

  const getDashboardFields = (): JSX.Element => {
    let elemFields: JSX.Element;
    switch (selectService) {
      case DashboardServiceType.Redash: {
        elemFields = (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboard-url">
                {requiredField('Dashboard Url:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="dashboard-url"
                name="dashboard-url"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={(e) => setDashboardUrl(e.target.value)}
              />
              {showErrorMsg.dashboardUrl && errorMsg('Url is required')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="api-key">
                {requiredField('Api key:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="api-key"
                name="api-key"
                placeholder="api key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
              <label className="tw-block tw-form-label" htmlFor="site-name">
                {requiredField('Site Name:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="site-name"
                name="site-name"
                placeholder="site name"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />
              {showErrorMsg.siteName && errorMsg('Site name is required')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="dashboard-url">
                {requiredField('Site Url:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="dashboard-url"
                name="dashboard-url"
                placeholder="http(s)://hostname:port"
                type="text"
                value={dashboardUrl}
                onChange={(e) => setDashboardUrl(e.target.value)}
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
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
                onChange={(e) => setServer(e.target.value)}
              />
              {showErrorMsg.server && errorMsg('Server is required')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="api-version">
                {requiredField('Api Version:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="api-version"
                name="api-version"
                placeholder="api version"
                type="text"
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
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
                onChange={(e) => setDashboardUrl(e.target.value)}
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
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
        <label className="tw-block tw-form-label" htmlFor="pipeline-url">
          {requiredField('Pipeline Url:')}
        </label>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="pipeline-url"
          id="pipeline-url"
          name="pipeline-url"
          placeholder="http(s)://hostname:port"
          type="text"
          value={pipelineUrl}
          onChange={(e) => setPipelineUrl(e.target.value)}
        />
        {showErrorMsg.pipelineUrl && errorMsg('Url is required')}
      </Field>
    );
  };

  const getOptionalFields = (): JSX.Element => {
    switch (serviceName) {
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

  const handleIngestionTypeSelection = (id: number) => {
    if (!isUndefined(ingestionTypeList)) {
      setIngestionTypeList(
        ingestionTypeList.map((d) => {
          return d.id === id
            ? {
                ...d,
                isIngestionActive: !d.isIngestionActive,
              }
            : {
                ...d,
                isIngestionActive: false,
              };
        })
      );

      setSelectedIngestionType(id === selectedIngestionType ? undefined : id);
    }
  };

  const getConfigurationData = () => {
    let data: {
      key: string;
      value: string | ReactNode;
    }[] = [];

    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        data = [
          {
            key: 'Host',
            value: url,
          },
          {
            key: 'Port',
            value: port,
          },
        ];

        if (username) {
          data.push({
            key: 'User Name',
            value: username,
          });
        }

        if (password) {
          data.push({
            key: 'Password',
            value: (
              <div>
                <span
                  className={classNames({
                    'tw-align-middle': !isPasswordVisible,
                  })}>
                  {isPasswordVisible
                    ? password
                    : ''.padStart(password.length, '*')}
                </span>
                <i
                  className={classNames(
                    'far tw-text-grey-body tw-ml-2',
                    {
                      'fa-eye-slash': isPasswordVisible,
                    },

                    { 'fa-eye ': !isPasswordVisible }
                  )}
                  onClick={() => setIsPasswordVisible((pre) => !pre)}
                />
              </div>
            ),
          });
        }

        if (database) {
          data.push({
            key: 'Database',
            value: database,
          });
        }

        break;

      case ServiceCategory.MESSAGING_SERVICES:
        data = [
          {
            key: 'Broker Url',
            value: brokers,
          },
          {
            key: 'Schema Registry',
            value: schemaRegistry,
          },
        ];

        break;

      case ServiceCategory.DASHBOARD_SERVICES:
        switch (selectService) {
          case DashboardServiceType.Redash:
            data = [
              {
                key: 'Dashboard Url',
                value: dashboardUrl,
              },
              {
                key: 'Api key',
                value: (
                  <div>
                    <span
                      className={classNames({
                        'tw-align-middle': !isApiKeyVisible,
                      })}>
                      {isApiKeyVisible
                        ? apiKey
                        : ''.padStart(apiKey.length, '*')}
                    </span>
                    <i
                      className={classNames(
                        'far tw-text-grey-body tw-ml-2',
                        {
                          'fa-eye-slash': isApiKeyVisible,
                        },

                        { 'fa-eye ': !isApiKeyVisible }
                      )}
                      onClick={() => setisApiKeyVisible((pre) => !pre)}
                    />
                  </div>
                ),
              },
            ];

            break;

          case DashboardServiceType.Tableau:
            data = [
              {
                key: 'Site Name',
                value: siteName,
              },
              {
                key: 'Site Url',
                value: dashboardUrl,
              },
              {
                key: 'Username',
                value: username,
              },
              {
                key: 'Password',
                value: (
                  <div>
                    <span
                      className={classNames({
                        'tw-align-middle': !isPasswordVisible,
                      })}>
                      {isPasswordVisible
                        ? password
                        : ''.padStart(password.length, '*')}
                    </span>
                    <i
                      className={classNames(
                        'far tw-text-grey-body tw-ml-2',
                        {
                          'fa-eye-slash': isPasswordVisible,
                        },

                        { 'fa-eye ': !isPasswordVisible }
                      )}
                      onClick={() => setIsPasswordVisible((pre) => !pre)}
                    />
                  </div>
                ),
              },
              {
                key: 'Server',
                value: server,
              },
              {
                key: 'Api Version',
                value: apiVersion,
              },
              {
                key: 'Environment',
                value: env,
              },
            ];

            break;

          default:
            data = [
              {
                key: 'Dashboard Url',
                value: dashboardUrl,
              },
              {
                key: 'Username',
                value: username,
              },
              {
                key: 'Password',
                value: (
                  <div>
                    <span
                      className={classNames({
                        'tw-align-middle': !isPasswordVisible,
                      })}>
                      {isPasswordVisible
                        ? password
                        : ''.padStart(password.length, '*')}
                    </span>
                    <i
                      className={classNames(
                        'far tw-text-grey-body tw-ml-2',
                        {
                          'fa-eye-slash': isPasswordVisible,
                        },

                        { 'fa-eye ': !isPasswordVisible }
                      )}
                      onClick={() => setIsPasswordVisible((pre) => !pre)}
                    />
                  </div>
                ),
              },
            ];

            break;
        }

        break;
      case ServiceCategory.PIPELINE_SERVICES:
        data = [
          {
            key: 'Pipeline Url',
            value: pipelineUrl,
          },
        ];

        break;
      default:
        break;
    }

    return data.filter((d) => Boolean(d.value));
  };

  const getServiceDetailsPreview = () => {
    const serviceDetailsData: Array<{
      key: string;
      value: string | ReactNode;
    }> = [
      { key: 'Service Type', value: selectService },
      {
        key: 'Service Name',
        value: name,
      },
    ];

    if (description) {
      serviceDetailsData.push({
        key: 'Description',
        value: (
          <RichTextEditorPreviewer
            enableSeeMoreVariant={false}
            markdown={description}
          />
        ),
      });
    }

    return serviceDetailsData;
  };

  const previousStepHandler = () => {
    let increamentCount = 1;

    if (activeStepperStep === 5 && !isIngestionEnable) {
      increamentCount = 2;
    }

    setActiveStepperStep((pre) => (pre > 1 ? pre - increamentCount : pre));
  };

  const forwardStepHandler = (activeStep: number) => {
    let isValid = false;

    switch (activeStep) {
      case 1:
        isValid = Boolean(selectService);
        setShowErrorMsg({
          ...showErrorMsg,
          selectService: !selectService,
        });

        break;

      case 2: {
        const newName = name.trim();
        isValid = data
          ? Boolean(newName)
          : Boolean(newName && !isServiceNameExists());
        setdescription(markdownRef.current?.getEditorContent() || '');
        setName(newName);
        setShowErrorMsg({
          ...showErrorMsg,
          name: !newName,
        });

        break;
      }

      case 3:
        isValid = handleErrorForAdditionalField();

        break;

      case 4:
        if (ingestionTypeList) {
          let noErrorListCount = 0;
          const newFormValue = ingestionTypeList.map((value) => {
            if (isEmpty(value.ingestionName) && value.isIngestionActive) {
              isValid = false;

              return {
                ...value,
                showError: true,
              };
            } else {
              noErrorListCount++;
            }

            return value;
          });
          isValid = ingestionTypeList.length === noErrorListCount;
          setIngestionTypeList(newFormValue);
        } else {
          isValid = true;
        }

        break;

      default:
        break;
    }

    setActiveStepperStep((pre) => {
      let increamentCount = 1;

      if (activeStepperStep === 3 && !isIngestionEnable) {
        increamentCount = 2;
      }

      return pre < steps.length && isValid ? pre + increamentCount : pre;
    });
  };

  const getActiveStepFields = (activeStep: number) => {
    switch (activeStep) {
      case 1:
        return (
          <Fragment>
            <div className="tw-flex tw-justify-center">
              <div
                className="tw-grid tw-grid-cols-3 tw-grid-flow-row tw-gap-5 tw-mt-4"
                data-testid="selectService">
                {serviceType.map((service) => (
                  <div
                    className={classNames(
                      'tw-flex tw-items-center tw-justify-between tw-p-2 tw-w-36 tw-cursor-pointer tw-border tw-rounded-md',
                      {
                        'tw-border-primary': service === selectService,
                      }
                    )}
                    data-testid={service}
                    key={service}
                    onClick={() => handleServiceClick(service)}>
                    <div className="tw-flex tw-items-center">
                      <div
                        className="tw-mr-2.5 tw-w-5"
                        data-testid="service-icon">
                        {getServiceLogo(service || '', 'tw-h-5 tw-w-5')}
                      </div>
                      <p className="">{service}</p>
                    </div>
                    {service === selectService && (
                      <SVGIcons alt="checkbox" icon={Icons.CHECKBOX_PRIMARY} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {showErrorMsg.selectService && errorMsg('Service is required')}
          </Fragment>
        );

      case 2:
        return (
          <Fragment>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="name">
                {requiredField('Service Name:')}
              </label>
              {!editData.edit ? (
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  data-testid="name"
                  id="name"
                  name="name"
                  placeholder="service name"
                  type="text"
                  value={name}
                  onChange={handleValidation}
                />
              ) : (
                <input
                  disabled
                  className="tw-form-inputs tw-px-3 tw-py-1 tw-cursor-not-allowed"
                  id="name"
                  name="name"
                  value={name}
                />
              )}
              {showErrorMsg.name && errorMsg('Service name is required.')}
              {sameNameError && errorMsg('Service name already exist.')}
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="description">
                Description:
              </label>
              <MarkdownWithPreview
                data-testid="description"
                ref={markdownRef}
                value={description}
              />
            </Field>
          </Fragment>
        );

      case 3:
        return getOptionalFields();

      case 4:
        return (
          <div className="tw-pt-3">
            {ingestionTypeList && ingestionTypeList.length > 0 ? (
              ingestionTypeList.map((type, id) => (
                <div
                  className="tw-border tw-rounded-md tw-mb-5"
                  data-testid="ingestion-details-container"
                  key={id}>
                  <div
                    className={classNames(
                      'tw-flex tw-justify-between tw-items-center tw-p-2',
                      { 'tw-border-b': type.isIngestionActive }
                    )}>
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <p>Metadata Extraction</p>
                    </div>
                    <div>
                      <div
                        className={classNames(
                          'toggle-switch',
                          type.isIngestionActive ? 'open' : null
                        )}
                        data-testid="ingestion-switch"
                        onClick={() => handleIngestionTypeSelection(type.id)}>
                        <div className="switch" />
                      </div>
                    </div>
                  </div>
                  <div
                    className={classNames(
                      'tw-p-4',
                      type.isIngestionActive ? 'tw-block' : 'tw-hidden'
                    )}>
                    <Field>
                      <label className="tw-block" htmlFor="ingestionName">
                        {requiredField('Ingestion name:')}
                      </label>
                      <input
                        disabled
                        className={classNames(
                          'tw-form-inputs tw-px-3 tw-py-1 tw-cursor-not-allowed'
                        )}
                        data-testid="ingestionName"
                        id="ingestionName"
                        name="ingestionName"
                        placeholder="Ingestion name"
                        type="text"
                        value={type.ingestionName}
                      />
                      {type.showError &&
                        type.isIngestionActive &&
                        isEmpty(type.ingestionName) &&
                        errorMsg('Ingestion Name is required')}
                    </Field>
                    <Field>
                      {getSeparator('Table Filter Pattern')}
                      <div className="tw-grid tw-grid-cols-2 tw-gap-x-4 tw-mt-1">
                        <div>
                          <label
                            className="tw-block"
                            htmlFor="tableIncludeFilterPattern">
                            Include:
                          </label>
                          <input
                            className="tw-form-inputs tw-px-3 tw-py-1"
                            data-testid="table-include-filter-pattern"
                            id="tableIncludeFilterPattern"
                            name="tableIncludeFilterPattern"
                            placeholder="Include filter patterns comma seperated"
                            type="text"
                            value={type.tableFilterPattern.includePattern}
                            onChange={(e) => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[
                                id
                              ].tableFilterPattern.includePattern =
                                e.target.value;
                              setIngestionTypeList(newFormValues);
                            }}
                          />
                        </div>
                        <div>
                          <label
                            className="tw-block"
                            htmlFor="tableExcludeFilterPattern">
                            Exclude:
                          </label>
                          <input
                            className="tw-form-inputs tw-px-3 tw-py-1"
                            data-testid="table-exclude-filter-pattern"
                            id="tableExcludeFilterPattern"
                            name="tableExcludeFilterPattern"
                            placeholder="Exclude filter patterns comma seperated"
                            type="text"
                            value={type.tableFilterPattern.excludePattern}
                            onChange={(e) => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[
                                id
                              ].tableFilterPattern.excludePattern =
                                e.target.value;
                              setIngestionTypeList(newFormValues);
                            }}
                          />
                        </div>
                      </div>
                    </Field>
                    <Field>
                      {getSeparator('Schema Filter Pattern')}
                      <div className="tw-grid tw-grid-cols-2 tw-gap-x-4 tw-mt-1">
                        <div>
                          <label
                            className="tw-block"
                            htmlFor="schemaIncludeFilterPattern">
                            Include:
                          </label>
                          <input
                            className="tw-form-inputs tw-px-3 tw-py-1"
                            data-testid="schema-include-filter-pattern"
                            id="schemaIncludeFilterPattern"
                            name="schemaIncludeFilterPattern"
                            placeholder="Include filter patterns comma seperated"
                            type="text"
                            value={type.schemaFilterPattern.includePattern}
                            onChange={(e) => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[
                                id
                              ].schemaFilterPattern.includePattern =
                                e.target.value;
                              setIngestionTypeList(newFormValues);
                            }}
                          />
                        </div>
                        <div>
                          <label
                            className="tw-block"
                            htmlFor="schemaExcludeFilterPattern">
                            Exclude:
                          </label>
                          <input
                            className="tw-form-inputs tw-px-3 tw-py-1"
                            data-testid="schema-exclude-filter-pattern"
                            id="schemaExcludeFilterPattern"
                            name="schemaExcludeFilterPattern"
                            placeholder="Exclude filter patterns comma seperated"
                            type="text"
                            value={type.schemaFilterPattern.excludePattern}
                            onChange={(e) => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[
                                id
                              ].schemaFilterPattern.excludePattern =
                                e.target.value;
                              setIngestionTypeList(newFormValues);
                            }}
                          />
                        </div>
                      </div>
                    </Field>

                    <Field>
                      <hr className="tw-pb-4 tw-mt-7" />
                      <div className="tw-flex tw-justify-between tw-pt-1">
                        <div className="tw-flex tw-gap-1">
                          <label>Include views</label>
                          <div
                            className={classNames(
                              'toggle-switch',
                              type.includeView ? 'open' : null
                            )}
                            data-testid="include-views"
                            onClick={() => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[id].includeView = !type.includeView;

                              setIngestionTypeList(newFormValues);
                            }}>
                            <div className="switch" />
                          </div>
                        </div>
                        <div className="tw-flex tw-gap-1">
                          <label>Enable data profiler</label>
                          <div
                            className={classNames(
                              'toggle-switch',
                              type.enableDataProfiler ? 'open' : null
                            )}
                            data-testid="data-profiler"
                            onClick={() => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[id].enableDataProfiler =
                                !type.enableDataProfiler;

                              setIngestionTypeList(newFormValues);
                            }}>
                            <div className="switch" />
                          </div>
                        </div>
                        <div className="tw-flex tw-gap-1">
                          <label>Ingest sample data</label>
                          <div
                            className={classNames(
                              'toggle-switch',
                              type.ingestSampleData ? 'open' : null
                            )}
                            data-testid="sample-data-ingestion"
                            onClick={() => {
                              const newFormValues = [...ingestionTypeList];
                              newFormValues[id].ingestSampleData =
                                !type.ingestSampleData;

                              setIngestionTypeList(newFormValues);
                            }}>
                            <div className="switch" />
                          </div>
                        </div>
                      </div>
                    </Field>

                    <div className="tw-mt-4" data-testid="schedule-interval">
                      <label htmlFor="">
                        {getSeparator(requiredField('Schedule interval', true))}
                      </label>
                      <div className="tw-flex tw-mt-2 tw-ml-3">
                        <CronEditor
                          value={type.repeatFrequency}
                          onChange={(v: string) => {
                            const newFormValues = [...ingestionTypeList];
                            newFormValues[id].repeatFrequency = v;

                            setIngestionTypeList(newFormValues);
                          }}
                        />
                      </div>
                    </div>
                    <div className="tw-grid tw-grid-cols-2 tw-gap-x-4">
                      <Field>
                        <label htmlFor="startDate">Start date (UTC):</label>
                        <input
                          className="tw-form-inputs tw-px-3 tw-py-1"
                          data-testid="start-date"
                          type="date"
                          value={type.startDate}
                          onChange={(e) => {
                            const newFormValues = [...ingestionTypeList];
                            newFormValues[id].startDate = e.target.value;

                            setIngestionTypeList(newFormValues);
                          }}
                        />
                      </Field>
                      <Field>
                        <label htmlFor="endDate">End date (UTC):</label>
                        <input
                          className="tw-form-inputs tw-px-3 tw-py-1"
                          data-testid="end-date"
                          min={type.startDate}
                          type="date"
                          value={type.endDate}
                          onChange={(e) => {
                            const newFormValues = [...ingestionTypeList];
                            newFormValues[id].endDate = e.target.value;

                            setIngestionTypeList(newFormValues);
                          }}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="tw-text-center tw-my-10 tw-text-lg">
                Ingestion is not available
              </p>
            )}
          </div>
        );

      case 5:
        return (
          <Fragment>
            <div
              className="tw-flex tw-flex-col tw-mt-6"
              data-testid="preview-section">
              <PreviewSection
                className="tw-mb-4 tw-mt-4"
                data={getServiceDetailsPreview()}
                header="Service Details"
              />

              <PreviewSection
                className="tw-mb-4 tw-mt-4"
                data={getConfigurationData()}
                header="Configuration"
              />

              {connectionOptions.length > 0 && (
                <PreviewSection
                  className="tw-mb-4 tw-mt-4"
                  data={connectionOptions.filter((v) => v.key && v.value)}
                  header="Connection Options"
                />
              )}

              {connectionArguments.length > 0 && (
                <PreviewSection
                  className="tw-mb-4 tw-mt-4"
                  data={connectionArguments.filter((v) => v.key && v.value)}
                  header="Connection Arguments"
                />
              )}

              {Boolean(ingestionTypeList && ingestionTypeList.length) && (
                <Fragment>
                  {ingestionTypeList?.map((value, i) => {
                    return value.isIngestionActive ? (
                      <Fragment key={i}>
                        <PreviewSection
                          className="tw-mb-4 tw-mt-4"
                          data={[
                            {
                              key: 'Ingestion name',
                              value: value.ingestionName,
                            },
                            {
                              key: 'Include views',
                              value: value.includeView ? 'Yes' : 'No',
                            },
                            {
                              key: 'Enable data profiler',
                              value: value.enableDataProfiler ? 'Yes' : 'No',
                            },
                            {
                              key: 'Ingest sample data',
                              value: value.ingestSampleData ? 'Yes' : 'No',
                            },
                          ]}
                          header="Scheduling"
                        />

                        <p className="tw-pl-6">
                          {cronstrue.toString(value.repeatFrequency || '', {
                            use24HourTimeFormat: true,
                            verbose: true,
                          })}
                        </p>

                        {(!isEmpty(value.tableFilterPattern.includePattern) ||
                          !isEmpty(
                            value.tableFilterPattern.excludePattern
                          )) && (
                          <PreviewSection
                            className="tw-mb-4 tw-mt-4"
                            data={[
                              {
                                key: 'Include',
                                value: !isEmpty(
                                  value.tableFilterPattern.includePattern
                                )
                                  ? value.tableFilterPattern.includePattern
                                  : 'None',
                              },
                              {
                                key: 'Exclude',
                                value: !isEmpty(
                                  value.tableFilterPattern.excludePattern
                                )
                                  ? value.tableFilterPattern.excludePattern
                                  : 'None',
                              },
                            ]}
                            header="Table Filter Patterns"
                          />
                        )}

                        {(!isEmpty(value.schemaFilterPattern.includePattern) ||
                          !isEmpty(
                            value.schemaFilterPattern.excludePattern
                          )) && (
                          <PreviewSection
                            className="tw-mb-4 tw-mt-4"
                            data={[
                              {
                                key: 'Include',
                                value: !isEmpty(
                                  value.schemaFilterPattern.includePattern
                                )
                                  ? value.schemaFilterPattern.includePattern
                                  : 'None',
                              },
                              {
                                key: 'Exclude',
                                value: !isEmpty(
                                  value.schemaFilterPattern.excludePattern
                                )
                                  ? value.schemaFilterPattern.excludePattern
                                  : 'None',
                              },
                            ]}
                            header="Schema Filter Patterns"
                          />
                        )}
                      </Fragment>
                    ) : null;
                  })}
                </Fragment>
              )}
            </div>
          </Fragment>
        );

      default:
        return;
    }
  };

  useEffect(() => {
    setServiceType(serviceTypes[serviceName] || []);
  }, [serviceName]);

  return (
    <dialog className="tw-modal" data-testid="service-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-w-2xl">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              data-testid="close-modal"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onCancel}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
        <div className="tw-modal-body">
          <IngestionStepper
            activeStep={activeStepperStep}
            stepperLineClassName={
              isIngestionEnable ? 'service-stepper-line' : undefined
            }
            steps={steps}
          />
          <form
            className="tw-min-w-full"
            data-testid="form"
            onSubmit={restrictFormSubmit}>
            <div className="tw-px-4 tw-pt-3 tw-mx-auto">
              {getActiveStepFields(activeStepperStep)}
            </div>
          </form>
        </div>

        <div
          className="tw-modal-footer tw-justify-between"
          data-testid="modal-footer">
          <Button
            className={classNames('tw-mr-2', {
              'tw-invisible':
                activeStepperStep === 1 || (data && activeStepperStep === 2),
            })}
            data-testid="previous-button"
            size="regular"
            theme="primary"
            variant="text"
            onClick={previousStepHandler}>
            <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
            <span>Previous</span>
          </Button>

          {activeStepperStep === 5 ? (
            <div className="tw-flex">
              <Button
                data-testid="deploy-button"
                size="regular"
                theme="primary"
                type="submit"
                variant="contained"
                onClick={handleSave}>
                <span className="tw-mr-2">Save</span>
                <SVGIcons alt="Deploy" icon="icon-deploy" />
              </Button>
            </div>
          ) : (
            <Button
              data-testid="next-button"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={() => forwardStepHandler(activeStepperStep)}>
              <span>Next</span>
              <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
};
