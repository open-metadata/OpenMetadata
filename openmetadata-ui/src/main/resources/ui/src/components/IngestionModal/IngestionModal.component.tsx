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
import { isEmpty } from 'lodash';
import { StepperStepType } from 'Models';
import { utc } from 'moment';
import React, { Fragment, ReactNode, useEffect, useState } from 'react';
import { DatabaseServiceType } from '../../generated/entity/services/databaseService';
import {
  AirflowPipeline,
  ConfigObject,
} from '../../generated/operations/pipelines/airflowPipeline';
import {
  getCurrentDate,
  getCurrentUserId,
  getSeparator,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CronEditor from '../common/CronEditor/CronEditor';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import {
  IngestionModalProps,
  ValidationErrorMsg,
} from './IngestionModal.interface';

const errorMsg = (value: string) => {
  return (
    <div className="tw-mt-1">
      <strong className="tw-text-red-500 tw-text-xs tw-italic">{value}</strong>
    </div>
  );
};

const STEPS: Array<StepperStepType> = [
  { name: 'Ingestion config', step: 1 },
  { name: 'Scheduling', step: 2 },
  { name: 'Review and Deploy', step: 3 },
];

const requiredField = (label: string) => (
  <>
    {label} <span className="tw-text-red-500">&nbsp;*</span>
  </>
);

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-6">{children}</div>;
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

const getIngestionName = (name: string) => {
  const nameString = name.trim().replace(/\s+/g, '_');

  return nameString.toLowerCase();
};

const IngestionModal: React.FC<IngestionModalProps> = ({
  isUpdating,
  header,
  serviceType,
  service = '',
  ingestionTypes,
  ingestionList,
  onCancel,
  addIngestion,
  updateIngestion,
  selectedIngestion,
}: IngestionModalProps) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const [startDate, setStartDate] = useState<string>(
    utc(selectedIngestion?.startDate).format('YYYY-MM-DD') || getCurrentDate()
  );
  const [endDate, setEndDate] = useState<string>(
    selectedIngestion?.endDate
      ? utc(selectedIngestion?.endDate).format('YYYY-MM-DD')
      : ''
  );

  const [ingestionName, setIngestionName] = useState<string>(
    selectedIngestion?.name ||
      `${service.trim().replace(/\s+/g, '_')}_${ingestionTypes[0]}` ||
      ''
  );
  const [ingestionType, setIngestionType] = useState<string>(
    selectedIngestion?.pipelineType || ingestionTypes[0] || ''
  );
  const [pipelineConfig] = useState(
    (selectedIngestion?.pipelineConfig.config || {}) as ConfigObject
  );
  const [tableIncludeFilter, setTableIncludeFilter] = useState(
    pipelineConfig.tableFilterPattern?.includes?.join(',') || ''
  );
  const [tableExcludesFilter, setTableExcludesFilter] = useState(
    pipelineConfig.tableFilterPattern?.excludes?.join(',') || ''
  );
  const [schemaIncludeFilter, setSchemaIncludeFilter] = useState(
    pipelineConfig.schemaFilterPattern?.includes?.join(',') || ''
  );
  const [schemaExcludesFilter, setSchemaExcludesFilter] = useState(
    pipelineConfig.schemaFilterPattern?.excludes?.join(',') || ''
  );
  const [includeViews, setIncludeViews] = useState<boolean>(
    pipelineConfig.includeViews || true
  );
  const [ingestSampleData, setIngestSampleData] = useState<boolean>(
    pipelineConfig.generateSampleData || true
  );
  const [excludeDataProfiler, setExcludeDataProfiler] = useState<boolean>(
    pipelineConfig.enableDataProfiler || false
  );

  const [ingestionSchedule, setIngestionSchedule] = useState<string>(
    selectedIngestion?.scheduleInterval || '5 * * * *'
  );

  const [warehouse, setWarehouse] = useState(pipelineConfig.warehouse);
  const [account, setAccount] = useState(pipelineConfig.account);

  const [showErrorMsg, setShowErrorMsg] = useState<ValidationErrorMsg>({
    selectService: false,
    name: false,
    username: false,
    password: false,
    ingestionType: false,
    host: false,
    database: false,
    ingestionSchedule: false,
    isPipelineExists: false,
    isPipelineNameExists: false,
    isInvalidName: false,
  });

  const isPipeLineNameExists = () => {
    return ingestionList.some(
      (i) =>
        i.name === getIngestionName(ingestionName) &&
        i.name !== selectedIngestion?.name
    );
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const name = event.target.name;

    switch (name) {
      case 'ingestionType':
        setIngestionType(value);
        setIngestionName(`${service}_${value}`);

        break;

      case 'ingestionSchedule':
        setIngestionSchedule(value);

        break;
      case 'name':
        setIngestionName(value);

        break;

      default:
        break;
    }
    setShowErrorMsg({
      ...showErrorMsg,
      [name]: !value,
    });
  };

  const forwardStepHandler = (activeStep: number) => {
    let isValid = false;
    switch (activeStep) {
      case 1:
        isValid = Boolean(ingestionName && ingestionType);
        setShowErrorMsg({
          ...showErrorMsg,
          name: !ingestionName,
          ingestionType: !ingestionType,
        });

        break;
      case 2:
        isValid = Boolean(ingestionSchedule);
        setShowErrorMsg({
          ...showErrorMsg,
          ingestionSchedule: !ingestionSchedule,
        });

        break;

      default:
        break;
    }
    setActiveStep((pre) => (pre < STEPS.length && isValid ? pre + 1 : pre));
  };

  const getActiveStepFields = (activeStep: number) => {
    switch (activeStep) {
      case 1:
        return (
          <Fragment>
            <Field>
              <label className="tw-block" htmlFor="name">
                {requiredField('Name:')}
              </label>
              <input
                className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                  'tw-cursor-not-allowed': isUpdating,
                })}
                data-testid="name"
                id="name"
                name="name"
                placeholder="Ingestion name"
                readOnly={isUpdating}
                type="text"
                value={ingestionName}
                onChange={handleValidation}
              />
              {showErrorMsg.name && errorMsg('Ingestion Name is required')}
              {showErrorMsg.isPipelineNameExists &&
                errorMsg(`Ingestion with similar name already exists.`)}
              {showErrorMsg.isInvalidName &&
                errorMsg(`Ingestion name with space is invalid.`)}
            </Field>

            <Field>
              <label className="tw-block " htmlFor="ingestionType">
                {requiredField('Type of ingestion:')}
              </label>
              <select
                className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                  'tw-cursor-not-allowed': isUpdating,
                })}
                data-testid="ingestion-type"
                disabled={isUpdating}
                id="ingestionType"
                name="ingestionType"
                value={ingestionType}
                onChange={handleValidation}>
                <option value="">Select ingestion type</option>
                {ingestionTypes.map((option, i) => (
                  <option key={i} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {showErrorMsg.ingestionType &&
                errorMsg('Ingestion Type is required')}
            </Field>

            {serviceType === DatabaseServiceType.Snowflake && (
              <div className="tw-grid tw-grid-cols-2 tw-gap-x-4 tw-mt-6">
                <div>
                  <label className="tw-block" htmlFor="warehouse">
                    Warehouse:
                  </label>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    data-testid="warehouse"
                    id="warehouse"
                    name="warehouse"
                    placeholder="Warehouse"
                    type="text"
                    value={warehouse}
                    onChange={(e) => {
                      setWarehouse(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="tw-block" htmlFor="account">
                    Account:
                  </label>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    data-testid="account"
                    id="account"
                    name="account"
                    placeholder="Account"
                    type="text"
                    value={account}
                    onChange={(e) => {
                      setAccount(e.target.value);
                    }}
                  />
                </div>
              </div>
            )}

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
                    value={tableIncludeFilter}
                    onChange={(e) => {
                      setTableIncludeFilter(e.target.value);
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
                    value={tableExcludesFilter}
                    onChange={(e) => {
                      setTableExcludesFilter(e.target.value);
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
                    value={schemaIncludeFilter}
                    onChange={(e) => {
                      setSchemaIncludeFilter(e.target.value);
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
                    value={schemaExcludesFilter}
                    onChange={(e) => {
                      setSchemaExcludesFilter(e.target.value);
                    }}
                  />
                </div>
              </div>
            </Field>

            <Field>
              <hr className="tw-pb-4 tw-mt-7" />
              <div className="tw-flex tw-justify-between">
                <div className="tw-flex tw-gap-1">
                  <label>Include views:</label>
                  <div
                    className={classNames(
                      'toggle-switch',
                      includeViews ? 'open' : null
                    )}
                    data-testid="include-views"
                    onClick={() => setIncludeViews(!includeViews)}>
                    <div className="switch" />
                  </div>
                </div>
                <div className="tw-flex tw-gap-1">
                  <label>Enable data profiler:</label>
                  <div
                    className={classNames(
                      'toggle-switch',
                      excludeDataProfiler ? 'open' : null
                    )}
                    data-testid="data-profiler"
                    onClick={() =>
                      setExcludeDataProfiler(!excludeDataProfiler)
                    }>
                    <div className="switch" />
                  </div>
                </div>
                <div className="tw-flex tw-gap-1">
                  <label>Ingest sample data</label>
                  <div
                    className={classNames(
                      'toggle-switch',
                      ingestSampleData ? 'open' : null
                    )}
                    data-testid="ingest-sample-data"
                    onClick={() => {
                      setIngestSampleData(!ingestSampleData);
                    }}>
                    <div className="switch" />
                  </div>
                </div>
              </div>
            </Field>
          </Fragment>
        );
      case 2:
        return (
          <Fragment>
            <div className="tw-mt-4" data-testid="schedule-interval">
              <label htmlFor="">{requiredField('Schedule interval:')}</label>
              <div className="tw-flex tw-mt-2 tw-ml-3">
                <CronEditor
                  value={ingestionSchedule}
                  onChange={(v: string) => setIngestionSchedule(v)}
                />
                {showErrorMsg.ingestionSchedule &&
                  errorMsg('Ingestion schedule is required')}
              </div>
            </div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-x-2">
              <Field>
                <label htmlFor="startDate">Start date (UTC):</label>
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  data-testid="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field>
                <label htmlFor="endDate">End date (UTC):</label>
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  data-testid="end-date"
                  min={startDate}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>
          </Fragment>
        );
      case 3:
        return (
          <Fragment>
            <div
              className="tw-flex tw-flex-col tw-mt-6"
              data-testid="preview-section">
              <PreviewSection
                className="tw-mb-4 tw-mt-4"
                data={[
                  { key: 'Name', value: ingestionName },
                  { key: 'Ingestion Type', value: ingestionType },
                ]}
                header="Ingestion Details"
              />

              {(!isEmpty(tableIncludeFilter) ||
                !isEmpty(tableExcludesFilter)) && (
                <PreviewSection
                  className="tw-mb-4 tw-mt-4"
                  data={[
                    {
                      key: 'Include',
                      value: !isEmpty(tableIncludeFilter)
                        ? tableIncludeFilter
                        : 'None',
                    },
                    {
                      key: 'Exclude',
                      value: !isEmpty(tableExcludesFilter)
                        ? tableExcludesFilter
                        : 'None',
                    },
                  ]}
                  header="Table Filter Patterns"
                />
              )}

              {(!isEmpty(schemaIncludeFilter) ||
                !isEmpty(schemaExcludesFilter)) && (
                <PreviewSection
                  className="tw-mb-4 tw-mt-4"
                  data={[
                    {
                      key: 'Include',
                      value: !isEmpty(schemaIncludeFilter)
                        ? schemaIncludeFilter
                        : 'None',
                    },
                    {
                      key: 'Exclude',
                      value: !isEmpty(schemaExcludesFilter)
                        ? schemaExcludesFilter
                        : 'None',
                    },
                  ]}
                  header="Schema Filter Patterns"
                />
              )}

              <PreviewSection
                className="tw-mt-6"
                data={[
                  {
                    key: 'Ingestion name',
                    value: ingestionName,
                  },
                  {
                    key: 'Include views',
                    value: includeViews ? 'Yes' : 'No',
                  },
                  {
                    key: 'Enable data profiler',
                    value: excludeDataProfiler ? 'Yes' : 'No',
                  },
                  {
                    key: 'Ingest sample data',
                    value: ingestSampleData ? 'Yes' : 'No',
                  },
                ]}
                header="Scheduling"
              />
              <p className="tw-pl-6 tw-pt-4 tw-pb-5">
                {cronstrue.toString(ingestionSchedule || '', {
                  use24HourTimeFormat: true,
                  verbose: true,
                })}
              </p>
            </div>
          </Fragment>
        );

      default:
        return null;
    }
  };

  const onSaveHandler = (triggerIngestion = false) => {
    const ingestionObj: AirflowPipeline = {
      name: ingestionName,
      pipelineConfig: {
        schema: selectedIngestion?.pipelineConfig.schema,
        config: {
          includeViews: includeViews,
          generateSampleData: ingestSampleData,
          enableDataProfiler: excludeDataProfiler,
          schemaFilterPattern:
            !isEmpty(schemaIncludeFilter) || !isEmpty(schemaExcludesFilter)
              ? {
                  includes: !isEmpty(schemaIncludeFilter)
                    ? schemaIncludeFilter.split(',')
                    : undefined,
                  excludes: !isEmpty(schemaExcludesFilter)
                    ? schemaExcludesFilter.split(',')
                    : undefined,
                }
              : undefined,
          tableFilterPattern:
            !isEmpty(tableIncludeFilter) || !isEmpty(tableExcludesFilter)
              ? {
                  includes: !isEmpty(tableIncludeFilter)
                    ? tableIncludeFilter.split(',')
                    : undefined,
                  excludes: !isEmpty(tableExcludesFilter)
                    ? tableExcludesFilter.split(',')
                    : undefined,
                }
              : undefined,
        },
      },
      service: {
        type: selectedIngestion?.service.type || '',
        id: selectedIngestion?.service.id || '',
      },
      owner: {
        id: selectedIngestion?.owner?.id || getCurrentUserId(),
        type: selectedIngestion?.owner?.type || 'user',
      },
      scheduleInterval: ingestionSchedule,
      startDate: startDate as unknown as Date,
      endDate: endDate as unknown as Date,
      forceDeploy: true,
      pipelineType:
        selectedIngestion?.pipelineType ||
        (ingestionType as AirflowPipeline['pipelineType']),
    };

    if (isUpdating) {
      updateIngestion?.(ingestionObj, triggerIngestion);
    } else {
      addIngestion?.(ingestionObj, triggerIngestion);
    }
  };

  useEffect(() => {
    setShowErrorMsg({
      ...showErrorMsg,
      // isPipelineExists: isPipelineExists(),
      isPipelineNameExists: isPipeLineNameExists(),
      isInvalidName: Boolean(ingestionName.match(/\s+/)),
    });
  }, [ingestionType, ingestionName]);

  useEffect(() => {
    if (endDate) {
      const startDt = new Date(startDate);
      const endDt = new Date(endDate);
      if (endDt.getTime() < startDt.getTime()) {
        setEndDate('');
      }
    }
  }, [startDate]);

  return (
    <dialog className="tw-modal" data-testid="ingestion-modal-container">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-w-2xl">
        <div className="tw-modal-header">
          <p className="tw-modal-title" data-testid="modal-title">
            {header}
          </p>
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
        <div className="tw-modal-body" data-testid="modal-body">
          <IngestionStepper
            activeStep={activeStep}
            stepperLineClassName="edit-ingestion-line"
            steps={STEPS}
          />

          <form className="tw-min-w-full" data-testid="form">
            <div className="tw-px-4">{getActiveStepFields(activeStep)}</div>
          </form>
        </div>
        <div
          className="tw-modal-footer tw-justify-between"
          data-testid="modal-footer">
          <Button
            className={classNames('tw-mr-2', {
              'tw-invisible': activeStep === 1,
            })}
            data-testid="previous-button"
            size="regular"
            theme="primary"
            variant="text"
            onClick={() => setActiveStep((pre) => (pre > 1 ? pre - 1 : pre))}>
            <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
            <span>Previous</span>
          </Button>

          {activeStep === 3 ? (
            <div className="tw-flex">
              <Button
                data-testid="deploy-button"
                size="regular"
                theme="primary"
                type="submit"
                variant="contained"
                onClick={() => onSaveHandler()}>
                <span className="tw-mr-2">Deploy</span>
                <SVGIcons alt="Deploy" icon="icon-deploy" />
              </Button>
            </div>
          ) : (
            <Button
              data-testid="next-button"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={() => forwardStepHandler(activeStep)}>
              <span>Next</span>
              <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default IngestionModal;
