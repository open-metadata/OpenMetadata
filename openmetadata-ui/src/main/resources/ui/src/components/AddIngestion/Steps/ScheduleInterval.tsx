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

import React from 'react';
import { Button } from '../../buttons/Button/Button';
import CronEditor from '../../common/CronEditor/CronEditor';
import { Field } from '../../Field/Field';
import { ScheduleIntervalProps } from '../addIngestion.interface';

const ScheduleInterval = ({
  repeatFrequency,
  handleRepeatFrequencyChange,
  startDate,
  handleStartDateChange,
  endDate,
  handleEndDateChange,
  onBack,
  onDeloy,
}: ScheduleIntervalProps) => {
  return (
    <div data-testid="schedule-intervel-container">
      <Field>
        <div className="tw-flex tw-mt-2 tw-ml-3">
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

        <Button
          data-testid="deploy-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={onDeloy}>
          <span>Deploy</span>
        </Button>
      </Field>
    </div>
  );
};

export default ScheduleInterval;
