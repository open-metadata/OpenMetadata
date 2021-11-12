import classNames from 'classnames';
import React, { Fragment, useState } from 'react';
import { serviceTypes } from '../../constants/services.const';
import { Button } from '../buttons/Button/Button';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';

type Props = {
  header: string;
  onSave: () => void;
  onCancel: () => void;
};
type Steps = {
  name: string;
  step: number;
  completed: boolean;
};

const STEPS: Array<Steps> = [
  { name: 'Ingestion details', step: 1, completed: false },
  { name: 'Connector config', step: 2, completed: false },
  { name: 'Scheduling', step: 3, completed: false },
  { name: 'Review and Deploy', step: 4, completed: false },
];
const requiredField = (label: string) => (
  <>
    {label} <span className="tw-text-red-500">&nbsp;*</span>
  </>
);

const IngestionModal = ({ header, onCancel }: Props) => {
  const [steps] = useState<Array<Steps>>(STEPS);
  const [activeStep, setActiveStep] = useState<number>(1);

  const Field = ({ children }: { children: React.ReactNode }) => {
    return <div className="tw-mt-6">{children}</div>;
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
                {serviceTypes['databaseServices'].map((service, index) => (
                  <option key={index} value={service}>
                    {service}
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
        return <></>;
      case 4:
        return <></>;

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
          <IngestionStepper activeStep={activeStep} steps={steps} />

          <form className="tw-min-w-full" data-testid="form">
            {getActiveStepFields(activeStep)}
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
              setActiveStep((pre) => (pre < steps.length ? pre + 1 : pre))
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
