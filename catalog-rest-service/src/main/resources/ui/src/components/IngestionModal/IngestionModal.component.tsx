import classNames from 'classnames';
import React, { Fragment, useState } from 'react';
// import { serviceTypes } from '../../constants/services.const';
import { getIngestionTypeList } from '../../utils/ServiceUtils';
import { Button } from '../buttons/Button/Button';
import CronEditor from '../common/CronEditor/CronEditor.component';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { Steps } from '../IngestionStepper/IngestionStepper.interface';
import './IngestionModal.css';
import { IngestionModalProps } from './IngestionModal.interface';

const STEPS: Array<Steps> = [
  { name: 'Ingestion details', step: 1 },
  { name: 'Connector config', step: 2 },
  { name: 'Scheduling', step: 3 },
  { name: 'Review and Deploy', step: 4 },
];
const requiredField = (label: string) => (
  <>
    {label} <span className="tw-text-red-500">&nbsp;*</span>
  </>
);

const IngestionModal: React.FC<IngestionModalProps> = ({
  header,
  name = '',
  service = '',
  serviceList = [], // TODO: remove default assignment after resolving prop validation warning
  type = '',
  schedule = '',
  connectorConfig,
  onCancel,
  onSave,
}: IngestionModalProps) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const [ingestionName, setIngestionName] = useState<string>(name || '');
  const [ingestionType, setIngestionType] = useState<string>(type);
  const [ingestionService, setIngestionService] = useState<string>(service);

  const [username, setUsername] = useState<string>(
    connectorConfig?.username || ''
  );
  const [password, setPassword] = useState<string>(
    connectorConfig?.password || ''
  );
  const [host, setHost] = useState<string>(connectorConfig?.host || '');
  const [database, setDatabase] = useState<string>(
    connectorConfig?.database || ''
  );
  const [includeFilterPattern, setIncludeFilterPattern] = useState<
    Array<string>
  >(connectorConfig?.includeFilterPattern || []);
  const [excludeFilterPattern, setExcludeFilterPattern] = useState<
    Array<string>
  >(connectorConfig?.excludeFilterPattern || []);
  const [includeViews, setIncludeViews] = useState<boolean>(
    connectorConfig?.includeViews || true
  );
  const [excludeDataProfiler, setExcludeDataProfiler] = useState<boolean>(
    connectorConfig?.excludeDataProfiler || false
  );

  const [ingestionSchedule, setIngestionSchedule] = useState<string>(
    schedule || '*/5 * * * *'
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
    data: Array<{ key: string; value: string }>;
    className: string;
  }) => {
    return (
      <div className={className}>
        {/* <hr className="tw-border-separator" /> */}
        <p className="preview-header tw-px-1">{header}</p>
        <div className="tw-grid tw-gap-4 tw-grid-cols-3 tw-place-content-center tw-pl-6">
          {data.map((d, i) => (
            <div key={i}>
              <p className="tw-text-xs tw-font-normal tw-text-grey-muted">
                {d.key}
              </p>
              <p>{d.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
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
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="name"
                name="name"
                placeholder="Ingestion name"
                type="text"
                value={ingestionName}
                onChange={(e) => setIngestionName(e.target.value)}
              />
            </Field>

            <Field>
              <label className="tw-block" htmlFor="selectService">
                {requiredField('Select Service:')}
              </label>
              <select
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="selectService"
                id="selectService"
                name="selectService"
                value={ingestionService}
                onChange={(e) => setIngestionService(e.target.value)}>
                <option value="">Select Service</option>
                {serviceList.map((service, index) => (
                  <option
                    key={index}
                    value={`${service.serviceType}$$${service.name}`}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <label className="tw-block " htmlFor="ingestionType">
                {requiredField('Type of ingestion:')}
              </label>
              <select
                className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                  'tw-cursor-not-allowed': !ingestionService,
                })}
                data-testid="selectService"
                disabled={!ingestionService}
                id="ingestionType"
                name="ingestionType"
                value={ingestionType}
                onChange={(e) => setIngestionType(e.target.value)}>
                <option value="">Select ingestion type</option>
                {(
                  getIngestionTypeList(ingestionService?.split('$$')?.[0]) || []
                ).map((service, index) => (
                  <option key={index} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </Field>
          </Fragment>
        );

      case 2:
        return (
          <Fragment>
            <Field>
              <label className="tw-block" htmlFor="username">
                {requiredField('Username:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="username"
                name="username"
                placeholder="User name"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="password">
                {requiredField('Password:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="password"
                name="password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="host">
                {requiredField('Host:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="host"
                name="host"
                placeholder="Host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="database">
                {requiredField('Database:')}
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="database"
                name="database"
                placeholder="Database"
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="includeFilterPattern">
                Include Filter Patterns:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="includeFilterPattern"
                name="includeFilterPattern"
                placeholder="Include filter patterns comma seperated"
                type="text"
                value={includeFilterPattern}
                onChange={(e) => setIncludeFilterPattern([e.target.value])}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="excludeFilterPattern">
                Exclude Filter Patterns:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="excludeFilterPattern"
                name="excludeFilterPattern"
                placeholder="Exclude filter patterns comma seperated"
                type="text"
                value={excludeFilterPattern}
                onChange={(e) => setExcludeFilterPattern([e.target.value])}
              />
            </Field>
            <Field>
              <div className="tw-flex tw-justify-between">
                <Fragment>
                  <label>Include views:</label>
                  <div
                    className={classNames(
                      'toggle-switch',
                      includeViews ? 'open' : null
                    )}
                    onClick={() => setIncludeViews(!includeViews)}>
                    <div className="switch" />
                  </div>
                </Fragment>
                <Fragment>
                  <label>Enable data profiler:</label>
                  <div
                    className={classNames(
                      'toggle-switch',
                      excludeDataProfiler ? 'open' : null
                    )}
                    onClick={() =>
                      setExcludeDataProfiler(!excludeDataProfiler)
                    }>
                    <div className="switch" />
                  </div>
                </Fragment>
              </div>
            </Field>
          </Fragment>
        );
      case 3:
        return (
          <Fragment>
            <div className="">
              <CronEditor
                className="tw-mt-10"
                defaultValue={ingestionSchedule}
                onChangeHandler={(v) => setIngestionSchedule(v)}>
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  id="schedule"
                  name="schedule"
                  type="text"
                  value={ingestionSchedule}
                  onChange={(e) => setIngestionSchedule(e.target.value)}
                />
                <p className="tw-text-grey-muted tw-text-xs tw-mt-1">
                  Note : Time formate is in UTC
                </p>
              </CronEditor>
            </div>
          </Fragment>
        );
      case 4:
        return (
          <Fragment>
            <div className="tw-flex tw-flex-col tw-mt-6">
              <PreviewSection
                className="tw-mb-4 tw-mt-4"
                data={[
                  { key: 'Name', value: 'SnowFlake Ingest' },
                  { key: 'Service Type', value: 'SnowFlake' },
                  { key: 'Ingestion Type', value: 'snowflake-ingest' },
                ]}
                header="Ingestion Details"
              />
              <PreviewSection
                className="tw-mb-4 tw-mt-6"
                data={[
                  { key: 'Username', value: 'Sachin.c' },
                  { key: 'Password', value: 'sachin.c' },
                  { key: 'Host', value: 'sachin.com' },
                  { key: 'Database', value: 'SnowSachinC' },
                  { key: 'Include views', value: 'Yes' },
                  { key: 'Enable Data Profiler', value: 'No' },
                ]}
                header="Connector Config"
              />
              <PreviewSection
                className="tw-mb-3 tw-mt-6"
                data={[]}
                header="Scheduling"
              />
              <CronEditor
                isReadOnly
                className="tw-flex tw-justify-items-start tw-pl-6"
                defaultValue={ingestionSchedule}
              />
            </div>
          </Fragment>
        );

      default:
        return null;
    }
  };

  // const forwardStepHandler = () => {};

  return (
    <dialog className="tw-modal" data-testid="service-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-w-2xl">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              data-testid="closeWhatsNew"
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
          <IngestionStepper activeStep={activeStep} steps={STEPS} />

          <form className="tw-min-w-full" data-testid="form">
            <div className="tw-px-4">{getActiveStepFields(activeStep)}</div>
          </form>
        </div>
        <div className="tw-modal-footer tw-justify-between">
          <Button
            className={classNames('tw-mr-2', {
              'tw-invisible': activeStep === 1,
            })}
            data-testid="cancel"
            size="regular"
            theme="primary"
            variant="text"
            onClick={() => setActiveStep((pre) => (pre > 1 ? pre - 1 : pre))}>
            <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
            <span>Previous</span>
          </Button>

          {activeStep === 4 ? (
            <Button
              data-testid="save-button"
              size="regular"
              theme="primary"
              type="submit"
              variant="contained"
              onClick={() => onSave()}>
              <span>Deploy</span>
            </Button>
          ) : (
            <Button
              data-testid="next-button"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={() =>
                setActiveStep((pre) => (pre < STEPS.length ? pre + 1 : pre))
              }>
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
