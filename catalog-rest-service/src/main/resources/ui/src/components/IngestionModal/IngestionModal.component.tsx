import React from 'react';
import { serviceTypes } from '../../constants/services.const';
import { Button } from '../buttons/Button/Button';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';

type Props = {
  header: string;
  onSave: () => void;
  onCancel: () => void;
};

const STEPS = [
  { name: 'Ingestion details' },
  { name: 'Connector config' },
  { name: 'Scheduling' },
  { name: 'Review and Deploy' },
];
const requiredField = (label: string) => (
  <>
    {label} <span className="tw-text-red-500">&nbsp;*</span>
  </>
);

const IngestionModal = ({ header, onCancel, onSave }: Props) => {
  return (
    <dialog className="tw-modal" data-testid="service-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-w-lg">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
        </div>
        <div className="tw-modal-body">
          <IngestionStepper isVertical={false} steps={STEPS} />

          <form className="tw-min-w-full" data-testid="form">
            <div className="tw-mt-4">
              <label className="tw-block tw-form-label" htmlFor="name">
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
            </div>
            <div className="tw-mt-4">
              <label className="tw-block tw-form-label" htmlFor="selectService">
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
            </div>
            <div className="tw-mt-4">
              <label className="tw-block tw-form-label" htmlFor="ingestionType">
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
            </div>
          </form>
        </div>
        <div className="tw-modal-footer tw-justify-between">
          <Button
            className="tw-mr-2"
            data-testid="cancel"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Discard
          </Button>
          <Button
            data-testid="save-button"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default IngestionModal;
