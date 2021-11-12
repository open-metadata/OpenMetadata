import classNames from 'classnames';
import { capitalize } from 'lodash';
import React, { Fragment, useState } from 'react';
import { serviceTypes } from '../../constants/services.const';
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
  onCancel,
  serviceList = [], // TODO: remove default assignment after resolving prop validation warning
}: IngestionModalProps) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [schedule, setschedule] = useState<string>('*/5 * * * *');

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
        <hr className="tw-border-t-2 tw-border-separator" />
        <p className="tw-font-normal preview-header tw-text-grey-muted tw-px-1">
          {header}
        </p>
        <div className="tw-grid tw-gap-2 tw-grid-cols-3 tw-place-content-center tw-mb-1 tw-pl-6">
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
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
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
                value=""
                // onChange={handleValidation}
              >
                <option value="">Select Service</option>
                {serviceList.map((service, index) => (
                  <option key={index} value={service.name}>
                    {capitalize(service.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <label className="tw-block " htmlFor="ingestionType">
                {requiredField('Type of ingestion:')}
              </label>
              <select
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="selectService"
                id="ingestionType"
                name="ingestionType"
                value=""
                // onChange={handleValidation}
              >
                <option value="">Select ingestion type</option>
                {serviceTypes['databaseServices'].map((service, index) => (
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
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
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
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
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
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
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
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="includeFilterPattern">
                Include Filter Pattern:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="includeFilterPattern"
                name="includeFilterPattern"
                placeholder="Include filter pattern comma seperated"
                type="text"
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
              />
            </Field>
            <Field>
              <label className="tw-block" htmlFor="excludeFilterPattern">
                Exclude Filter Pattern:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                id="excludeFilterPattern"
                name="excludeFilterPattern"
                placeholder="Exclude filter pattern comma seperated"
                type="text"
                value=""
                // onChange={(e) => setSiteName(e.target.value)}
              />
            </Field>
            <Field>
              <div className="tw-flex tw-justify-between">
                <Fragment>
                  <label>Include views:</label>
                  <div
                    className={classNames('toggle-switch open')}
                    // onClick={() => setIngestion(!ingestion)}
                  >
                    <div className="switch" />
                  </div>
                </Fragment>
                <Fragment>
                  <label>Enable data profiler:</label>
                  <div
                    className={classNames('toggle-switch open')}
                    // onClick={() => setIngestion(!ingestion)}
                  >
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
                defaultValue={schedule}
                onChangeHandler={(v) => setschedule(v)}>
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  id="schedule"
                  name="schedule"
                  type="text"
                  value={schedule}
                  // onChange={(e) => setSiteName(e.target.value)}
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
                className="tw-my-3"
                data={[
                  { key: 'Name', value: 'SnowFlake Ingest' },
                  { key: 'Service Type', value: 'SnowFlake' },
                  { key: 'Ingestion Type', value: 'snowflake-ingest' },
                ]}
                header="Ingestion Details"
              />
              <PreviewSection
                className="tw-my-3"
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
                className="tw-my-3"
                data={[]}
                header="Scheduling"
              />
              <CronEditor isReadOnly defaultValue={schedule} />
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

          <Button
            data-testid="save-button"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={() =>
              setActiveStep((pre) => (pre < STEPS.length ? pre + 1 : pre))
            }>
            <span>Next</span>
            <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default IngestionModal;
