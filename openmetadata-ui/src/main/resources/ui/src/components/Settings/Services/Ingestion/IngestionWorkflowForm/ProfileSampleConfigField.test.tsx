/*
 *  Copyright 2026 Collate.
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

import { FieldProps, IdSchema, Registry } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ProfileSampleConfig,
  ProfileSampleType,
  SampleConfigType,
  SamplingMethodType,
} from '../../../../../generated/metadataIngestion/databaseServiceProfilerPipeline';
import ProfileSampleConfigField from './ProfileSampleConfigField';

const mockOnChange = jest.fn();

const baseFieldProps: FieldProps<ProfileSampleConfig> = {
  autofocus: false,
  disabled: false,
  formContext: {},
  formData: undefined,
  hideError: undefined,
  id: 'root/profileSampleConfig',
  name: 'profileSampleConfig',
  idSchema: { $id: 'root/profileSampleConfig' } as IdSchema,
  idSeparator: '/',
  schema: { type: 'object', title: 'Profile Sample Config' },
  uiSchema: {},
  readonly: false,
  required: false,
  rawErrors: undefined,
  onChange: mockOnChange,
  onBlur: jest.fn(),
  onFocus: jest.fn(),
  registry: {} as Registry,
};

const staticFormData: ProfileSampleConfig = {
  sampleConfigType: SampleConfigType.Static,
  config: {
    profileSample: 80,
    profileSampleType: ProfileSampleType.Percentage,
    samplingMethodType: SamplingMethodType.Bernoulli,
  },
};

const dynamicFormData: ProfileSampleConfig = {
  sampleConfigType: SampleConfigType.Dynamic,
  config: {
    thresholds: [
      {
        rowCountThreshold: 1000000,
        profileSample: 10,
        profileSampleType: ProfileSampleType.Percentage,
        samplingMethodType: SamplingMethodType.Bernoulli,
      },
    ],
  },
};

describe('ProfileSampleConfigField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default (STATIC) rendering', () => {
    it('renders the sample-config-type selector', () => {
      render(<ProfileSampleConfigField {...baseFieldProps} />);

      expect(
        screen.getByTestId('sample-config-type-select')
      ).toBeInTheDocument();
      expect(screen.getByText('label.sample-config-type')).toBeInTheDocument();
    });

    it('shows static config fields when sampleConfigType is STATIC', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={staticFormData}
        />
      );

      expect(screen.getByTestId('profile-sample-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('profile-sample-type-select')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sampling-method-type-select')
      ).toBeInTheDocument();
    });

    it('shows static config fields by default when no formData is provided', () => {
      render(<ProfileSampleConfigField {...baseFieldProps} />);

      expect(screen.getByTestId('profile-sample-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('profile-sample-type-select')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sampling-method-type-select')
      ).toBeInTheDocument();
    });

    it('does not show dynamic threshold section in STATIC mode', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={staticFormData}
        />
      );

      expect(screen.queryByTestId('add-threshold-btn')).not.toBeInTheDocument();
      expect(
        screen.queryByText('label.threshold-plural')
      ).not.toBeInTheDocument();
    });

    it('displays the profile-sample input', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={staticFormData}
        />
      );

      expect(screen.getByTestId('profile-sample-input')).toBeInTheDocument();
    });
  });

  describe('DYNAMIC mode rendering', () => {
    it('shows the thresholds section when sampleConfigType is DYNAMIC', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(screen.getByText('label.threshold-plural')).toBeInTheDocument();
      expect(screen.getByTestId('add-threshold-btn')).toBeInTheDocument();
    });

    it('does not show static config fields in DYNAMIC mode', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(
        screen.queryByTestId('profile-sample-input')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-sample-type-select')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('sampling-method-type-select')
      ).not.toBeInTheDocument();
    });

    it('renders a threshold card for each threshold in formData', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(screen.getByText('label.threshold 1')).toBeInTheDocument();
      expect(screen.getByTestId('row-count-threshold-0')).toBeInTheDocument();
      expect(screen.getByTestId('profile-sample-0')).toBeInTheDocument();
      expect(screen.getByTestId('profile-sample-type-0')).toBeInTheDocument();
      expect(screen.getByTestId('sampling-method-type-0')).toBeInTheDocument();
    });

    it('renders multiple threshold cards when multiple thresholds exist', () => {
      const multiThresholdData: ProfileSampleConfig = {
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [
            { rowCountThreshold: 1000000, profileSample: 10 },
            { rowCountThreshold: 500000, profileSample: 20 },
          ],
        },
      };

      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={multiThresholdData}
        />
      );

      expect(screen.getByText('label.threshold 1')).toBeInTheDocument();
      expect(screen.getByText('label.threshold 2')).toBeInTheDocument();
      expect(screen.getByTestId('row-count-threshold-0')).toBeInTheDocument();
      expect(screen.getByTestId('row-count-threshold-1')).toBeInTheDocument();
    });

    it('renders the remove button for each threshold', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(screen.getByTestId('remove-threshold-0')).toBeInTheDocument();
    });

    it('shows empty threshold list with only the add button when thresholds array is empty', () => {
      const emptyDynamic: ProfileSampleConfig = {
        sampleConfigType: SampleConfigType.Dynamic,
        config: { thresholds: [] },
      };

      render(
        <ProfileSampleConfigField {...baseFieldProps} formData={emptyDynamic} />
      );

      expect(
        screen.queryByTestId('row-count-threshold-0')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('add-threshold-btn')).toBeInTheDocument();
    });
  });

  describe('Add threshold interaction', () => {
    it('calls onChange with a new default threshold when add button is clicked', () => {
      const emptyDynamic: ProfileSampleConfig = {
        sampleConfigType: SampleConfigType.Dynamic,
        config: { thresholds: [] },
      };

      render(
        <ProfileSampleConfigField {...baseFieldProps} formData={emptyDynamic} />
      );

      fireEvent.click(screen.getByTestId('add-threshold-btn'));

      expect(mockOnChange).toHaveBeenCalledWith({
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [{ rowCountThreshold: 1, profileSample: 100 }],
        },
      });
    });

    it('appends a new threshold to existing thresholds when add is clicked', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      fireEvent.click(screen.getByTestId('add-threshold-btn'));

      expect(mockOnChange).toHaveBeenCalledWith({
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [
            {
              rowCountThreshold: 1000000,
              profileSample: 10,
              profileSampleType: ProfileSampleType.Percentage,
              samplingMethodType: SamplingMethodType.Bernoulli,
            },
            { rowCountThreshold: 1, profileSample: 100 },
          ],
        },
      });
    });
  });

  describe('Remove threshold interaction', () => {
    it('calls onChange with the threshold removed when remove button is clicked', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      fireEvent.click(screen.getByTestId('remove-threshold-0'));

      expect(mockOnChange).toHaveBeenCalledWith({
        sampleConfigType: SampleConfigType.Dynamic,
        config: { thresholds: [] },
      });
    });

    it('removes the correct threshold when one of many is deleted', () => {
      const multiThresholdData: ProfileSampleConfig = {
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [
            { rowCountThreshold: 1000000, profileSample: 10 },
            { rowCountThreshold: 500000, profileSample: 20 },
          ],
        },
      };

      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={multiThresholdData}
        />
      );

      fireEvent.click(screen.getByTestId('remove-threshold-0'));

      expect(mockOnChange).toHaveBeenCalledWith({
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [{ rowCountThreshold: 500000, profileSample: 20 }],
        },
      });
    });
  });

  describe('Config type rendering', () => {
    it('shows static fields when formData has STATIC type', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={staticFormData}
        />
      );

      expect(screen.getByTestId('profile-sample-input')).toBeInTheDocument();
      expect(screen.queryByTestId('add-threshold-btn')).not.toBeInTheDocument();
    });

    it('shows dynamic fields when formData has DYNAMIC type', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(screen.getByTestId('add-threshold-btn')).toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-sample-input')
      ).not.toBeInTheDocument();
    });
  });

  describe('Label rendering', () => {
    it('renders all field labels in STATIC mode', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={staticFormData}
        />
      );

      expect(screen.getByText('label.profile-sample')).toBeInTheDocument();
      expect(screen.getByText('label.profile-sample-type')).toBeInTheDocument();
      expect(
        screen.getByText('label.sampling-method-type')
      ).toBeInTheDocument();
    });

    it('renders all field labels in DYNAMIC threshold card', () => {
      render(
        <ProfileSampleConfigField
          {...baseFieldProps}
          formData={dynamicFormData}
        />
      );

      expect(screen.getByText('label.row-count-threshold')).toBeInTheDocument();
      expect(screen.getByText('label.profile-sample')).toBeInTheDocument();
      expect(screen.getByText('label.profile-sample-type')).toBeInTheDocument();
      expect(
        screen.getByText('label.sampling-method-type')
      ).toBeInTheDocument();
    });
  });
});
