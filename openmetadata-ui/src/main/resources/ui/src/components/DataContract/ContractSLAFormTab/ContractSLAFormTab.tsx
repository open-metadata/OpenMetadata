/*
 *  Copyright 2025 Collate.
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
import {
  Box,
  Card,
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  HookForm,
  NumberInput,
  TimePicker,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button, Select } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import {
  MAX_LATENCY_UNITS,
  REFRESH_FREQUENCY_UNITS,
  RETENTION_UNITS,
} from '../../../constants/DataContract.constants';
import {
  DataContract,
  Timezone,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { generateSelectOptionsFromString } from '../../../utils/DataContract/DataContractUtils';
import { filterSelectOptions } from '../../../utils/FilterQueryUtils';
import { getPopupContainer } from '../../../utils/formPureUtils';
import { getColumnOptionsFromTableColumn } from '../../../utils/TablePureUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import './contract-sla-form-tab.less';
import {
  SlaFormValues,
  toContractSla,
  toSlaFormValues,
} from './ContractSLAFormTab.utils';

export const ContractSLAFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ onChange, onPrev, buttonProps, initialValues }) => {
  const { t } = useTranslation();
  const form = useForm<SlaFormValues>({ mode: 'onChange' });
  const { data: tableData } = useGenericContext();

  const columnOptions = useMemo(() => {
    const { columns } = tableData as Table;
    if (isEmpty(columns)) {
      return [];
    }

    return getColumnOptionsFromTableColumn(columns, true);
  }, [tableData]);

  const {
    RETENTION_UNIT_OPTIONS,
    MAX_LATENCY_OPTIONS,
    REFRESH_FREQUENCY_UNIT_OPTIONS,
    TIMEZONE_OPTIONS,
  } = useMemo(() => {
    return {
      REFRESH_FREQUENCY_UNIT_OPTIONS: generateSelectOptionsFromString(
        REFRESH_FREQUENCY_UNITS
      ),
      RETENTION_UNIT_OPTIONS: generateSelectOptionsFromString(RETENTION_UNITS),
      MAX_LATENCY_OPTIONS: generateSelectOptionsFromString(MAX_LATENCY_UNITS),
      TIMEZONE_OPTIONS: Object.values(Timezone).map((tz) => ({
        label: tz,
        value: tz,
      })),
    };
  }, []);

  const handleFormChange = () =>
    onChange({ sla: toContractSla(form.getValues()) });

  useEffect(() => {
    if (initialValues) {
      form.reset(toSlaFormValues(initialValues.sla));
    }
  }, [initialValues, form.reset]);

  return (
    <>
      <Card className="sla-container container bg-grey p-box">
        <div>
          <Typography className="contract-detail-form-tab-title">
            {t('label.sla')}
          </Typography>
          <Typography as="p" className="contract-detail-form-tab-description">
            {t('message.data-contract-sla-description')}
          </Typography>
        </div>

        <HookForm
          className="new-form-style contract-security-form"
          form={form}
          onSubmit={(event) => event.preventDefault()}>
          <Grid
            className="layout-row layout-grid"
            style={{ ...getLayoutGutter(12, 12) }}>
            <Grid.Item className="layout-column" span={12}>
              <div className="sla-form-card-container">
                <Typography className="sla-form-card-title">
                  {t('label.refresh-frequency')}
                </Typography>
                <Typography className="sla-form-card-description">
                  {t('message.refresh-frequency-contract-description')}
                </Typography>
                <Grid
                  className="layout-row layout-grid"
                  style={{ ...getLayoutGutter(12) }}>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="refresh_frequency_interval"
                      rules={{
                        required: t('message.field-text-is-required', {
                          fieldText: t('label.interval'),
                        }),
                        min: {
                          value: 0,
                          message: t('message.entity-size-less-than', {
                            entity: t('label.interval'),
                            min: 0,
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.interval')} />
                          <NumberInput
                            {...field}
                            aria-label={t('label.interval')}
                            inputDataTestId="refresh-frequency-interval-input"
                            isInvalid={!!fieldState.error}
                            placeholder={t('label.enter-entity', {
                              entity: t('label.interval'),
                            })}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="refresh_frequency_unit">
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.unit')} />
                          <Select
                            {...field}
                            allowClear
                            aria-label={t('label.unit')}
                            data-testid="refresh-frequency-unit-select"
                            options={REFRESH_FREQUENCY_UNIT_OPTIONS}
                            placeholder={t('label.select-entity', {
                              entity: t('label.unit'),
                            })}
                            popupClassName="refresh-frequency-unit-select"
                            status={fieldState.error ? 'error' : undefined}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                </Grid>
              </div>
            </Grid.Item>
            <Grid.Item className="layout-column" span={12}>
              <div className="sla-form-card-container">
                <Typography className="sla-form-card-title">
                  {t('label.max-latency')}
                </Typography>
                <Typography className="sla-form-card-description">
                  {t('message.max-latency-contract-description')}
                </Typography>
                <Grid
                  className="layout-row layout-grid"
                  style={{ ...getLayoutGutter(24) }}>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="max_latency_value"
                      rules={{
                        required: t('message.field-text-is-required', {
                          fieldText: t('label.value'),
                        }),
                        min: {
                          value: 0,
                          message: t('message.entity-size-less-than', {
                            entity: t('label.value'),
                            min: 0,
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.value')} />
                          <NumberInput
                            {...field}
                            aria-label={t('label.value')}
                            inputDataTestId="max-latency-value-input"
                            isInvalid={!!fieldState.error}
                            placeholder={t('label.enter-entity', {
                              entity: t('label.value'),
                            })}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField control={form.control} name="max_latency_unit">
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.unit')} />
                          <Select
                            {...field}
                            allowClear
                            aria-label={t('label.unit')}
                            data-testid="max-latency-unit-select"
                            options={MAX_LATENCY_OPTIONS}
                            placeholder={t('label.select-entity', {
                              entity: t('label.unit'),
                            })}
                            popupClassName="max-latency-unit-select"
                            status={fieldState.error ? 'error' : undefined}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                </Grid>
              </div>
            </Grid.Item>
            <Grid.Item className="layout-column" span={12}>
              <div className="sla-form-card-container">
                <Typography className="sla-form-card-title">
                  {t('label.availability-time')}
                </Typography>
                <Typography className="sla-form-card-description">
                  {t('message.availability-time-contract-description')}
                </Typography>
                <Typography className="text-xs m-b-xs" color="secondary" />

                <Grid
                  className="layout-row layout-grid"
                  style={{ ...getLayoutGutter(24) }}>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField control={form.control} name="availabilityTime">
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel
                            label={t('label.time')}
                            required={false}
                          />
                          <TimePicker
                            granularity="minute"
                            hourCycle={24}
                            {...field}
                            aria-label={t('label.time')}
                            className="availability-time-picker w-full"
                            data-testid="availability"
                            isInvalid={!!fieldState.error}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField control={form.control} name="timezone">
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel
                            label={t('label.timezone')}
                            required={false}
                            tooltip={t(
                              'message.contract-sla-timezone-availability-default'
                            )}
                          />
                          <Select
                            {...field}
                            allowClear
                            showSearch
                            aria-label={t('label.timezone')}
                            data-testid="timezone-select"
                            placeholder={t('label.select-entity', {
                              entity: t('label.timezone'),
                            })}
                            popupClassName="timezone-select"
                            status={fieldState.error ? 'error' : undefined}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}>
                            {TIMEZONE_OPTIONS.map((item) => (
                              <Select.Option
                                data-testid={`timezone-item-${item.label}`}
                                key={item.value}>
                                <Tooltip
                                  arrow
                                  excludeTriggerFromTabOrder
                                  title={item.label}
                                  triggerClassName="tw:inline-flex">
                                  {item.label}
                                </Tooltip>
                              </Select.Option>
                            ))}
                          </Select>
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                </Grid>
              </div>
            </Grid.Item>
            <Grid.Item className="layout-column" span={12}>
              <div className="sla-form-card-container">
                <Typography className="sla-form-card-title">
                  {t('label.retention')}
                </Typography>
                <Typography className="sla-form-card-description">
                  {t('message.time-line-data-retention-description')}
                </Typography>
                <Grid
                  className="layout-row layout-grid"
                  style={{ ...getLayoutGutter(24) }}>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="retention_period"
                      rules={{
                        required: t('message.field-text-is-required', {
                          fieldText: t('label.period'),
                        }),
                        min: {
                          value: 0,
                          message: t('message.entity-size-less-than', {
                            entity: t('label.period'),
                            min: 0,
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.period')} />
                          <NumberInput
                            {...field}
                            aria-label={t('label.period')}
                            inputDataTestId="retention-period-input"
                            isInvalid={!!fieldState.error}
                            placeholder={t('label.enter-entity', {
                              entity: t('label.period'),
                            })}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField control={form.control} name="retention_unit">
                      {({ field, fieldState }) => (
                        <Box direction="col" gap={2}>
                          <FormItemLabel required label={t('label.unit')} />
                          <Select
                            {...field}
                            allowClear
                            aria-label={t('label.unit')}
                            data-testid="retention-unit-select"
                            options={RETENTION_UNIT_OPTIONS}
                            placeholder={t('label.select-entity', {
                              entity: t('label.unit'),
                            })}
                            popupClassName="retention-unit-select"
                            status={fieldState.error ? 'error' : undefined}
                            onChange={(value) => {
                              field.onChange(value);
                              handleFormChange();
                            }}
                          />
                          {fieldState.error && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                  </Grid.Item>
                </Grid>
              </div>
            </Grid.Item>

            <Grid.Item className="layout-column" span={12}>
              <div className="sla-form-card-container">
                <Typography className="sla-form-card-title">
                  {t('label.column')}
                </Typography>
                <Typography className="sla-form-card-description">
                  {t('message.contract-sla-column-name-description')}
                </Typography>

                <FormField control={form.control} name="columnName">
                  {({ field, fieldState }) => (
                    <Box direction="col" gap={2}>
                      <FormItemLabel
                        label={t('label.column-name')}
                        required={false}
                      />
                      <Select
                        {...field}
                        allowClear
                        showSearch
                        aria-label={t('label.column-name')}
                        data-testid="columnName-select"
                        filterOption={filterSelectOptions}
                        getPopupContainer={getPopupContainer}
                        id="columnName-select"
                        options={columnOptions}
                        placeholder={t('label.please-enter-entity-name', {
                          entity: t('label.column'),
                        })}
                        status={fieldState.error ? 'error' : undefined}
                        onChange={(value) => {
                          field.onChange(value);
                          handleFormChange();
                        }}
                      />
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
              </div>
            </Grid.Item>
          </Grid>
        </HookForm>
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          onClick={onPrev}>
          {buttonProps.prevLabel ?? t('label.previous')}
        </Button>
      </div>
    </>
  );
};
