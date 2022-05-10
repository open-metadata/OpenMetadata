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
import { Button } from '../../buttons/Button/Button';
import CronEditor from '../../common/CronEditor/CronEditor';
import { Field } from '../../Field/Field';
import Loader from '../../Loader/Loader';
import { ScheduleIntervalProps } from '../addIngestion.interface';

const ScheduleInterval = ({
  status,
  repeatFrequency,
  handleRepeatFrequencyChange,
  startDate,
  handleStartDateChange,
  endDate,
  handleEndDateChange,
  submitButtonLabel,
  isStartDateDisabled = false,
  onBack,
  onDeploy,
}: ScheduleIntervalProps) => {
  return (
    <div data-testid="schedule-intervel-container">
      <Field>
        <div>
          <CronEditor
            value={repeatFrequency}
            onChange={handleRepeatFrequencyChange}
          />
        </div>
      </Field>
      <div className="tw-grid tw-grid-cols-2 tw-gap-x-4">
        <Field>
          <label htmlFor="startDate">Start date (UTC):</label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="start-date"
            disabled={isStartDateDisabled}
            type="date"
            value={startDate}
            onChange={(e) => {
              handleStartDateChange(e.target.value);
            }}
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
            onChange={(e) => {
              handleEndDateChange(e.target.value);
            }}
          />
        </Field>
      </div>
      <Field className="tw-flex tw-justify-end tw-mt-5">
        <Button
          className="tw-mr-2"
          data-testid="back-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onBack}>
          <span>Back</span>
        </Button>

        {status === 'waiting' ? (
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
            data-testid="deploy-button"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={onDeploy}>
            <span>{submitButtonLabel}</span>
          </Button>
        )}
      </Field>
    </div>
  );
};

export default ScheduleInterval;
