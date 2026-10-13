/*
 *  Copyright 2022 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Box,
  Button,
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  HookForm,
  NumberInput,
  SlideoutMenu,
  Toggle,
  TreeSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { Input, Select } from 'antd';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  getTreeSelectValue,
  getTreeSelectValues,
  toTreeSelectNodes,
} from '../../../../../utils/TreeSelect.utils';

import { getLayoutGutter } from '../../../../../utils/common/layout.utils';

import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isEqual, isNil, isUndefined, pick, startCase } from 'lodash';
import {
  lazy,
  Reducer,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../../../assets/svg/ic-delete.svg';
import {
  DEFAULT_INCLUDE_PROFILE,
  INTERVAL_TYPE_OPTIONS,
  INTERVAL_UNIT_OPTIONS,
  MIN_PROFILE_SAMPLE,
  PROFILE_SAMPLE_OPTIONS,
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL,
  TIME_BASED_PARTITION,
} from '../../../../../constants/profiler.constant';
import { CSMode } from '../../../../../enums/codemirror.enum';
import {
  PartitionIntervalTypes,
  ProfileSampleType,
  SampleConfigType,
  TableProfilerConfig,
} from '../../../../../generated/entity/data/table';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../../../rest/tableAPI';
import { reducerWithoutAction } from '../../../../../utils/ObjectUtils';
import profilerMetricsClassBase from '../../../../../utils/ProfilerMetricsClassBase';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import Loader from '../../../../common/Loader/Loader';
import SliderWithInput from '../../../../common/SliderWithInput/SliderWithInput';
import '../table-profiler.less';
import {
  ProfilerForm,
  ProfilerSettingModalState,
  ProfilerSettingsModalProps,
} from '../TableProfiler.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../SchemaEditor/SchemaEditor'))
);

// Legacy dropdowns must stay inside the modal's focus and accessibility boundary.
const getPopupContainer = (triggerNode: HTMLElement) =>
  triggerNode.parentElement ?? document.body;

type ProfilerFormValues = Pick<
  ProfilerForm,
  | 'enablePartitioning'
  | 'partitionColumnName'
  | 'partitionIntervalType'
  | 'partitionIntegerRangeStart'
  | 'partitionIntegerRangeEnd'
  | 'partitionInterval'
  | 'partitionIntervalUnit'
  | 'profileSampleType'
  | 'profileSamplePercentage'
  | 'profileSampleRows'
  | 'includeColumns'
> & {
  sampleDataCount?: number;
  // RHF needs object rows; saving unwraps them to the API's string list.
  partitionValues: { value: string }[];
};

const ProfilerSettingsModal: React.FC<ProfilerSettingsModalProps> = ({
  tableId,
  columns,
  visible,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();
  const form = useForm<ProfilerFormValues>({
    mode: 'onChange',
    defaultValues: {
      profileSampleType: ProfileSampleType.Percentage,
      profileSamplePercentage: 100,
      sampleDataCount: 50,
      includeColumns: DEFAULT_INCLUDE_PROFILE,
      partitionValues: [{ value: '' }],
    },
  });
  const includeFields = useFieldArray({
    control: form.control,
    name: 'includeColumns',
  });
  const partitionFields = useFieldArray({
    control: form.control,
    name: 'partitionValues',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const initialState: ProfilerSettingModalState = useMemo(
    () => ({
      data: undefined,
      sqlQuery: '',
      profileSample: 100,
      sampleDataCount: 50,
      excludeCol: [],
      includeCol: DEFAULT_INCLUDE_PROFILE,
      enablePartition: false,
      selectedProfileSampleType: ProfileSampleType.Percentage,
    }),
    []
  );
  const [state, dispatch] = useReducer<
    Reducer<ProfilerSettingModalState, Partial<ProfilerSettingModalState>>
  >(reducerWithoutAction, initialState);

  const handleStateChange = useCallback(
    (newState: Partial<ProfilerSettingModalState>) => {
      dispatch(newState);
    },
    []
  );

  const { columnOptions, columnWithAllOption } = useMemo(() => {
    const columnOptions = columns.map(({ name }) => ({
      label: name,
      value: name,
    }));
    const columnWithAllOption = [
      {
        label: t('label.all'),
        value: 'all',
      },
      ...columnOptions,
    ];

    return { columnOptions, columnWithAllOption };
  }, [columns]);
  const metricsOptions = useMemo(() => {
    const profilerMetrics = profilerMetricsClassBase.getProfilerMetricOptions();
    const metricsOptions = [
      {
        title: t('label.all'),
        value: 'all',
        key: 'all',
        children: profilerMetrics.map((metric) => ({
          title: startCase(metric),
          value: metric,
          key: metric,
        })),
      },
    ];

    return toTreeSelectNodes(metricsOptions);
  }, [columns]);

  const fetchMetrics = useCallback(
    async () => ({ nodes: metricsOptions }),
    [metricsOptions]
  );

  const partitionIntervalType = useWatch({
    control: form.control,
    name: 'partitionIntervalType',
  });

  const partitionColumnOptions = useMemo(() => {
    const partitionColumnOptions = columns.reduce((result, column) => {
      const filter = partitionIntervalType
        ? SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL[partitionIntervalType]
        : [];
      if (filter.includes(column.dataType)) {
        return [
          ...result,
          {
            value: column.name,
            label: column.name,
          },
        ];
      }

      return result;
    }, [] as { value: string; label: string }[]);

    return partitionColumnOptions;
  }, [columns, partitionIntervalType]);

  const updateInitialConfig = async (
    tableProfilerConfig: TableProfilerConfig
  ) => {
    const {
      includeColumns,
      partitioning,
      profileQuery,
      excludeColumns,
      sampleDataCount,
      profileSampleConfig,
    } = tableProfilerConfig;
    const staticConfig = profileSampleConfig?.config;
    const profileSample = staticConfig?.profileSample;
    const profileSampleType = staticConfig?.profileSampleType;

    const applyProfileSampleFields = () => {
      form.reset({
        ...form.getValues(),
        profileSampleType,
        profileSamplePercentage:
          !isNil(profileSample) &&
          profileSampleType === ProfileSampleType.Percentage
            ? profileSample
            : undefined,
        profileSampleRows:
          !isNil(profileSample) && profileSampleType === ProfileSampleType.Rows
            ? profileSample
            : undefined,
      });
    };

    const applyIncludeColumns = () => {
      if (!includeColumns || includeColumns.length === 0) {
        return;
      }

      const includeColValue = includeColumns.map((col) => {
        if (
          isUndefined(col.metrics) ||
          (col.metrics && col.metrics.length === 0)
        ) {
          col.metrics = ['all'];
        }

        return col;
      });
      form.reset({ ...form.getValues(), includeColumns: includeColValue });
      handleStateChange({
        includeCol: includeColValue,
      });
    };

    const applyPartitioning = () => {
      if (!partitioning) {
        return;
      }

      handleStateChange({
        enablePartition: partitioning.enablePartitioning || false,
      });

      form.reset({
        ...form.getValues(),
        ...partitioning,
        partitionValues: partitioning.partitionValues?.map((value) => ({
          value,
        })) ?? [{ value: '' }],
      });
    };

    handleStateChange({
      sqlQuery: profileQuery ?? '',
      profileSample: profileSample,
      excludeCol: excludeColumns ?? [],
      selectedProfileSampleType: profileSampleType,
      sampleDataCount,
    });
    form.reset({
      ...form.getValues(),
      sampleDataCount: sampleDataCount ?? initialState.sampleDataCount,
    });

    applyProfileSampleFields();
    applyIncludeColumns();
    applyPartitioning();

    Promise.resolve();
  };

  const fetchProfileConfig = async () => {
    setIsDataLoading(true);
    try {
      const response = await getTableProfilerConfig(tableId);
      const { tableProfilerConfig } = response;
      if (tableProfilerConfig) {
        handleStateChange({
          data: tableProfilerConfig,
        });

        await updateInitialConfig(tableProfilerConfig);
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.fetch-table-profiler-config-error')
      );
    } finally {
      setIsDataLoading(false);
    }
  };

  const getIncludesColumns = (
    columns: ProfilerFormValues['includeColumns']
  ) => {
    const includeCols = columns.filter(
      ({ columnName }) => !isUndefined(columnName)
    );

    handleStateChange({
      includeCol: includeCols,
    });

    return includeCols.map((col) => {
      if (col.metrics && col.metrics[0] === 'all') {
        return {
          columnName: col.columnName,
        };
      }

      return col;
    });
  };

  const handleSave = useCallback(
    async (data: ProfilerFormValues) => {
      const buildPartitioning = (): TableProfilerConfig['partitioning'] => {
        if (!state.enablePartition) {
          return undefined;
        }

        // Read straight from the form: the loaded config is pushed into the
        // form with a reset, which never fires input callbacks, so
        // any state copy is stale until the user edits a partition field.
        const partitionData = pick(
          data,
          'partitionColumnName',
          'partitionIntegerRangeEnd',
          'partitionIntegerRangeStart',
          'partitionInterval',
          'partitionIntervalType',
          'partitionIntervalUnit',
          'partitionValues'
        );

        return {
          ...partitionData,
          partitionValues:
            data.partitionIntervalType === PartitionIntervalTypes.ColumnValue
              ? partitionData.partitionValues
                  ?.map((item) => item.value)
                  .filter((value) => !isEmpty(value))
              : undefined,
          enablePartitioning: state.enablePartition,
        };
      };

      const buildProfileConfig = (): TableProfilerConfig => {
        const { excludeCol, sqlQuery } = state;
        const includeCol = data.includeColumns;
        const {
          profileSamplePercentage,
          profileSampleRows,
          profileSampleType,
          sampleDataCount,
        } = data;

        const profileSampleValue =
          profileSampleType === ProfileSampleType.Percentage
            ? profileSamplePercentage
            : profileSampleRows;
        const profileSample = profileSampleType
          ? profileSampleValue
          : undefined;

        return {
          excludeColumns: excludeCol.length > 0 ? excludeCol : undefined,
          profileQuery: !isEmpty(sqlQuery) ? sqlQuery : undefined,
          profileSampleConfig:
            !isNil(profileSampleType) && !isNil(profileSample)
              ? {
                  sampleConfigType: SampleConfigType.Static,
                  config: {
                    profileSample,
                    profileSampleType,
                  },
                }
              : undefined,
          includeColumns: !isEqual(includeCol, DEFAULT_INCLUDE_PROFILE)
            ? getIncludesColumns(includeCol)
            : undefined,
          partitioning: buildPartitioning(),
          sampleDataCount,
        };
      };

      setIsLoading(true);
      const profileConfig = buildProfileConfig();
      try {
        const response = await putTableProfileConfig(tableId, profileConfig);
        if (response) {
          showSuccessToast(
            t('server.update-entity-success', {
              entity: t('label.profile-config'),
            })
          );
          onVisibilityChange(false);
        } else {
          throw t('server.entity-updating-error', {
            entity: t('label.profile-config'),
          });
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.profile-config'),
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [state, getIncludesColumns, onVisibilityChange, t, tableId]
  );

  const handleCancel = useCallback(() => {
    const { data } = state;
    data && updateInitialConfig(data);
    onVisibilityChange(false);
  }, [state]);

  const handleProfileSampleType = useCallback(
    (selectedProfileSampleType: ProfileSampleType) =>
      handleStateChange({
        selectedProfileSampleType,
      }),
    []
  );

  const handleProfileSample = useCallback(
    (value: number | null) =>
      handleStateChange({
        profileSample: Number(value),
      }),
    []
  );

  const handleCodeMirrorChange = useCallback((value: string) => {
    handleStateChange({
      sqlQuery: value,
    });
  }, []);

  const resetPartitionFields = (resetType: boolean) => {
    form.setValue('partitionColumnName', undefined);
    form.setValue('partitionIntegerRangeStart', undefined);
    form.setValue('partitionIntegerRangeEnd', undefined);
    form.setValue('partitionIntervalUnit', undefined);
    form.setValue('partitionInterval', undefined);
    partitionFields.replace([{ value: '' }]);
    if (resetType) {
      form.setValue('partitionIntervalType', undefined);
    }
  };

  const handleChange =
    (field: keyof ProfilerSettingModalState) =>
    (value: ProfilerSettingModalState[keyof ProfilerSettingModalState]) =>
      handleStateChange({
        [field]: value,
      });

  const handleExcludeCol = handleChange('excludeCol');

  const handleEnablePartition = handleChange('enablePartition');

  useEffect(() => {
    if (tableId) {
      fetchProfileConfig();
    } else {
      setIsDataLoading(false);
    }
  }, [tableId]);

  const drawerFooter = (
    <div className="drawer-footer-actions">
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal"
        gap={4}
        itemClassName="layout-space-item">
        <Button color="secondary" onPress={handleCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          form="profiler-setting-form"
          isLoading={isLoading}
          type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </div>
  );

  const renderContent = isDataLoading ? (
    <div className="profiler-settings-loader">
      <Loader />
    </div>
  ) : (
    <HookForm
      className="profiler-settings-drawer-content new-form-style"
      form={form}
      id="profiler-setting-form"
      onSubmit={form.handleSubmit(handleSave)}>
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(16, 16) }}>
        <Grid.Item
          className="layout-column"
          data-testid="profile-sample-container"
          span={24}>
          <div className="tw:flex tw:flex-col tw:gap-4">
            <FormField control={form.control} name="profileSampleType">
              {({ field, fieldState }) => (
                <Box className="tw:w-full" direction="col" gap={2}>
                  <FormItemLabel
                    label={t('label.profile-sample-type', {
                      type: '',
                    })}
                  />
                  <Select
                    allowClear
                    aria-label={t('label.profile-sample-type', {
                      type: '',
                    })}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the initial settings field
                    autoFocus={visible}
                    {...field}
                    className="w-full"
                    data-testid="profile-sample"
                    getPopupContainer={getPopupContainer}
                    options={PROFILE_SAMPLE_OPTIONS}
                    placeholder={t('label.please-select-entity', {
                      entity: t('label.profile-sample-type', {
                        type: '',
                      }),
                    })}
                    status={fieldState.error ? 'error' : undefined}
                    onChange={(value) => {
                      field.onChange(value);
                      handleProfileSampleType(value);
                    }}
                  />
                  {fieldState.error && (
                    <HintText isInvalid>{fieldState.error.message}</HintText>
                  )}
                </Box>
              )}
            </FormField>
            {state?.selectedProfileSampleType ===
              ProfileSampleType.Percentage && (
              <FormField control={form.control} name="profileSamplePercentage">
                {({ field, fieldState }) => (
                  <Box className="tw:w-full" direction="col" gap={2}>
                    <FormItemLabel
                      label={t('label.profile-sample-type', {
                        type: t('label.value'),
                      })}
                    />
                    <SliderWithInput
                      aria-label={t('label.profile-sample-type', {
                        type: t('label.value'),
                      })}
                      {...field}
                      className="p-x-xs"
                      min={MIN_PROFILE_SAMPLE}
                      onChange={(value) => {
                        field.onChange(value);
                        handleProfileSample(value);
                      }}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
            )}
            {state?.selectedProfileSampleType === ProfileSampleType.Rows && (
              <FormField control={form.control} name="profileSampleRows">
                {({ field, fieldState }) => (
                  <Box className="tw:w-full" direction="col" gap={2}>
                    <FormItemLabel
                      label={t('label.profile-sample-type', {
                        type: t('label.value'),
                      })}
                    />
                    <NumberInput
                      aria-label={t('label.profile-sample-type', {
                        type: t('label.value'),
                      })}
                      {...field}
                      className="w-full"
                      inputDataTestId="metric-number-input"
                      isInvalid={!!fieldState.error}
                      minValue={MIN_PROFILE_SAMPLE}
                      placeholder={t('label.please-enter-value', {
                        name: t('label.row-count-lowercase'),
                      })}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
            )}
            <FormField control={form.control} name="sampleDataCount">
              {({ field, fieldState }) => (
                <Box className="m-b-0" direction="col" gap={2}>
                  <FormItemLabel label={t('label.sample-data-count')} />
                  <NumberInput
                    aria-label={t('label.sample-data-count')}
                    {...field}
                    className="w-full"
                    inputDataTestId="sample-data-count-input"
                    isInvalid={!!fieldState.error}
                    minValue={0}
                    placeholder={t('label.please-enter-value', {
                      name: t('label.sample-data-count-lowercase'),
                    })}
                  />
                  {fieldState.error && (
                    <HintText isInvalid>{fieldState.error.message}</HintText>
                  )}
                </Box>
              )}
            </FormField>
          </div>
        </Grid.Item>
        <Grid.Item
          className="layout-column"
          data-testid="sql-editor-container"
          span={24}>
          <p className="m-b-xs">
            {t('label.profile-sample-type', {
              type: t('label.query'),
            })}{' '}
          </p>

          <SchemaEditor
            className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
            data-testid="profiler-setting-sql-editor"
            mode={{ name: CSMode.SQL }}
            refreshEditor={visible}
            value={state?.sqlQuery ?? ''}
            onChange={handleCodeMirrorChange}
          />
        </Grid.Item>
        <Grid.Item
          className="layout-column"
          data-testid="exclude-column-container"
          span={24}>
          <Typography as="p">{t('message.enable-column-profile')}</Typography>
          <p className="text-xs m-b-xss">{t('label.exclude')}:</p>
          <Select
            allowClear
            className="w-full"
            data-testid="exclude-column-select"
            dropdownStyle={{ maxHeight: 200, overflowY: 'auto' }}
            getPopupContainer={getPopupContainer}
            mode="multiple"
            options={columnOptions}
            placeholder={t('label.select-column-plural-to-exclude')}
            size="middle"
            value={state?.excludeCol}
            onChange={handleExcludeCol}
          />
        </Grid.Item>

        <Grid.Item className="layout-column" span={24}>
          <div>
            <>
              <div className="d-flex items-center m-b-xss">
                <p className="w-form-label text-xs m-r-xs">
                  {`${t('label.include')}:`}
                </p>
                <Button
                  aria-label={t('label.add')}
                  color="primary"
                  iconLeading={<PlusOutlined />}
                  size="xs"
                  onClick={() => includeFields.append({ metrics: ['all'] })}
                />
              </div>
              <div
                className={classNames({
                  'h-max-40 overflow-y-auto': includeFields.fields.length > 1,
                })}
                data-testid="include-column-container">
                {includeFields.fields.map(({ id }, name) => (
                  <Grid
                    className="layout-row layout-grid"
                    key={id}
                    style={{ ...getLayoutGutter(16) }}>
                    <Grid.Item className="layout-column" span={12}>
                      <FormField
                        control={form.control}
                        name={`includeColumns.${name}.columnName`}>
                        {({ field, fieldState }) => (
                          <Box
                            className="w-full m-b-md"
                            direction="col"
                            gap={2}>
                            <Select
                              {...field}
                              allowClear
                              showSearch
                              className="w-full"
                              data-testid="include-column-select"
                              getPopupContainer={getPopupContainer}
                              options={columnWithAllOption}
                              placeholder={t(
                                'label.select-column-plural-to-include'
                              )}
                              size="middle"
                              status={fieldState.error ? 'error' : undefined}
                              onChange={(value) => {
                                field.onChange(value);
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
                    <Grid.Item className="layout-column flex" span={12}>
                      <FormField
                        control={form.control}
                        name={`includeColumns.${name}.metrics`}>
                        {({ field, fieldState }) => (
                          <Box
                            className="w-full m-b-md"
                            direction="col"
                            gap={2}>
                            <TreeSelect
                              cascadeSelection
                              multiple
                              searchable
                              aria-label={t('label.metric-type')}
                              fetchData={fetchMetrics}
                              maxVisibleItems={2}
                              placeholder={t('label.please-select')}
                              selectedDisplayStrategy="parent"
                              value={getTreeSelectValue(
                                metricsOptions,
                                field.value
                              )}
                              onBlur={field.onBlur}
                              onChange={(selection) =>
                                field.onChange(getTreeSelectValues(selection))
                              }
                            />
                            {fieldState.error && (
                              <HintText isInvalid>
                                {fieldState.error.message}
                              </HintText>
                            )}
                          </Box>
                        )}
                      </FormField>
                      <Button
                        aria-label={t('label.remove')}
                        color="tertiary"
                        iconLeading={
                          <Icon
                            component={IconDelete}
                            style={{ fontSize: '16px' }}
                          />
                        }
                        onClick={() => includeFields.remove(name)}
                      />
                    </Grid.Item>
                  </Grid>
                ))}
              </div>
            </>
            <Grid
              className="layout-row layout-grid"
              style={{ ...getLayoutGutter(16, 16) }}>
              <Grid.Item className="layout-column" span={24}>
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal"
                  gap={3}
                  itemClassName="layout-space-item">
                  <p>{t('label.enable-partition')}</p>
                  <FormField control={form.control} name="enablePartitioning">
                    {({ field, fieldState }) => (
                      <Box className="m-b-0" direction="col" gap={2}>
                        <Toggle
                          aria-label={t('label.enable-partition')}
                          data-testid="enable-partition-switch"
                          isSelected={!!field.value}
                          size="sm"
                          onChange={(value) => {
                            field.onChange(value);
                            handleEnablePartition(value);
                            resetPartitionFields(true);
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
                </Box>
              </Grid.Item>
              <Grid.Item className="layout-column" span={12}>
                <FormField
                  control={form.control}
                  name="partitionIntervalType"
                  rules={{
                    required: {
                      value: !!state.enablePartition,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.interval-type'),
                      }),
                    },
                  }}>
                  {({ field, fieldState }) => (
                    <Box className="m-b-0" direction="col" gap={2}>
                      <FormItemLabel
                        label={
                          <Typography size="text-xs">
                            {t('label.interval-type')}
                          </Typography>
                        }
                        required={state.enablePartition}
                      />
                      <Select
                        aria-label={t('label.interval-type')}
                        {...field}
                        allowClear
                        className="w-full"
                        data-testid="interval-type"
                        disabled={!state?.enablePartition}
                        getPopupContainer={getPopupContainer}
                        options={INTERVAL_TYPE_OPTIONS}
                        placeholder={t('message.select-interval-type')}
                        size="middle"
                        status={fieldState.error ? 'error' : undefined}
                        onChange={(value) => {
                          field.onChange(value);
                          resetPartitionFields(false);
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
                  name="partitionColumnName"
                  rules={{
                    required: {
                      value: !!state.enablePartition,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.column-entity', {
                          entity: t('label.name'),
                        }),
                      }),
                    },
                  }}>
                  {({ field, fieldState }) => (
                    <Box className="m-b-0" direction="col" gap={2}>
                      <FormItemLabel
                        label={
                          <Typography size="text-xs">
                            {t('label.column-entity', {
                              entity: t('label.name'),
                            })}
                          </Typography>
                        }
                        required={state.enablePartition}
                      />
                      <Select
                        aria-label={t('label.column-entity', {
                          entity: t('label.name'),
                        })}
                        {...field}
                        allowClear
                        showSearch
                        className="w-full"
                        data-testid="column-name"
                        disabled={!state?.enablePartition}
                        getPopupContainer={getPopupContainer}
                        options={partitionColumnOptions}
                        placeholder={t('message.select-column-name')}
                        size="middle"
                        status={fieldState.error ? 'error' : undefined}
                        onChange={(value) => {
                          field.onChange(value);
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
              {partitionIntervalType &&
              TIME_BASED_PARTITION.includes(partitionIntervalType) ? (
                <>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="partitionInterval"
                      rules={{
                        required: {
                          value: !!state.enablePartition,
                          message: t('message.field-text-is-required', {
                            fieldText: t('label.interval'),
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box className="m-b-0" direction="col" gap={2}>
                          <FormItemLabel
                            label={
                              <Typography size="text-xs">
                                {t('label.interval')}
                              </Typography>
                            }
                            required={state.enablePartition}
                          />
                          <NumberInput
                            aria-label={t('label.interval')}
                            {...field}
                            className="w-full"
                            inputDataTestId="interval-required"
                            isDisabled={!state?.enablePartition}
                            isInvalid={!!fieldState.error}
                            placeholder={t('message.enter-interval')}
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
                      name="partitionIntervalUnit"
                      rules={{
                        required: {
                          value: !!state.enablePartition,
                          message: t('message.field-text-is-required', {
                            fieldText: t('label.interval-unit'),
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box className="m-b-0" direction="col" gap={2}>
                          <FormItemLabel
                            label={
                              <Typography size="text-xs">
                                {t('label.interval-unit')}
                              </Typography>
                            }
                            required={state.enablePartition}
                          />
                          <Select
                            aria-label={t('label.interval-unit')}
                            {...field}
                            allowClear
                            className="w-full"
                            data-testid="select-interval-unit"
                            disabled={!state?.enablePartition}
                            getPopupContainer={getPopupContainer}
                            options={INTERVAL_UNIT_OPTIONS}
                            placeholder={t('message.select-interval-unit')}
                            size="middle"
                            status={fieldState.error ? 'error' : undefined}
                            onChange={(value) => {
                              field.onChange(value);
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
                </>
              ) : null}
              {PartitionIntervalTypes.IntegerRange === partitionIntervalType ? (
                <>
                  <Grid.Item className="layout-column" span={12}>
                    <FormField
                      control={form.control}
                      name="partitionIntegerRangeStart"
                      rules={{
                        required: {
                          value: !!state.enablePartition,
                          message: t('message.field-text-is-required', {
                            fieldText: t('label.start-entity', {
                              entity: t('label.range'),
                            }),
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box className="m-b-0" direction="col" gap={2}>
                          <FormItemLabel
                            label={
                              <Typography size="text-xs">
                                {t('label.start-entity', {
                                  entity: t('label.range'),
                                })}
                              </Typography>
                            }
                            required={state.enablePartition}
                          />
                          <NumberInput
                            aria-label={t('label.start-entity', {
                              entity: t('label.range'),
                            })}
                            {...field}
                            className="w-full"
                            inputDataTestId="start-range"
                            isDisabled={!state?.enablePartition}
                            isInvalid={!!fieldState.error}
                            placeholder={t('message.enter-a-field', {
                              field: t('label.start-entity', {
                                entity: t('label.range'),
                              }),
                            })}
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
                      name="partitionIntegerRangeEnd"
                      rules={{
                        required: {
                          value: !!state.enablePartition,
                          message: t('message.field-text-is-required', {
                            fieldText: t('label.end-entity', {
                              entity: t('label.range'),
                            }),
                          }),
                        },
                      }}>
                      {({ field, fieldState }) => (
                        <Box className="m-b-0" direction="col" gap={2}>
                          <FormItemLabel
                            label={
                              <Typography size="text-xs">
                                {t('label.end-entity', {
                                  entity: t('label.range'),
                                })}
                              </Typography>
                            }
                            required={state.enablePartition}
                          />
                          <NumberInput
                            aria-label={t('label.end-entity', {
                              entity: t('label.range'),
                            })}
                            {...field}
                            className="w-full"
                            inputDataTestId="end-range"
                            isDisabled={!state?.enablePartition}
                            isInvalid={!!fieldState.error}
                            placeholder={t('message.enter-a-field', {
                              field: t('label.end-entity', {
                                entity: t('label.range'),
                              }),
                            })}
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
                </>
              ) : null}

              {PartitionIntervalTypes.ColumnValue === partitionIntervalType ? (
                <Grid.Item className="layout-column" span={24}>
                  <>
                    <div className="flex items-center m-b-xs">
                      <p className="w-form-label text-xs m-r-sm">
                        {`${t('label.value')}:`}
                      </p>
                      <Button
                        aria-label={t('label.add')}
                        color="primary"
                        iconLeading={<PlusOutlined />}
                        size="xs"
                        onClick={() => partitionFields.append({ value: '' })}
                      />
                    </div>

                    {partitionFields.fields.map(({ id }, name) => (
                      <Grid
                        className="layout-row layout-grid"
                        key={id}
                        style={{ ...getLayoutGutter(16) }}>
                        <Grid.Item className="layout-column flex" span={24}>
                          <FormField
                            control={form.control}
                            name={`partitionValues.${name}.value`}
                            rules={{
                              required: {
                                value: !!state.enablePartition,
                                message: t('message.field-text-is-required', {
                                  fieldText: t('label.value'),
                                }),
                              },
                            }}>
                            {({ field, fieldState }) => (
                              <Box
                                className="w-full m-b-md"
                                direction="col"
                                gap={2}>
                                <Input
                                  {...field}
                                  className="w-full"
                                  data-testid="partition-value"
                                  disabled={!state?.enablePartition}
                                  placeholder={t('message.enter-a-field', {
                                    field: t('label.value'),
                                  })}
                                  status={
                                    fieldState.error ? 'error' : undefined
                                  }
                                  onChange={(value) => {
                                    field.onChange(value);
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
                          <Button
                            aria-label={t('label.remove')}
                            color="tertiary"
                            iconLeading={
                              <Icon
                                component={IconDelete}
                                style={{ fontSize: '16px' }}
                              />
                            }
                            onClick={() => partitionFields.remove(name)}
                          />
                        </Grid.Item>
                      </Grid>
                    ))}
                  </>
                </Grid.Item>
              ) : null}
            </Grid>
          </div>
        </Grid.Item>
      </Grid>
    </HookForm>
  );

  return (
    <SlideoutMenu
      aria-label={t('label.setting-plural')}
      // Keep the overlay above positioned chart labels without covering form popovers.
      className="profiler-settings-drawer tw:min-w-96 tw:z-50"
      data-testid="profiler-settings-modal"
      dialogClassName="tw:gap-0"
      isDismissable={false}
      isOpen={visible}
      width="40%"
      onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <SlideoutMenu.Header onClose={handleCancel}>
        <Typography size="text-md" weight="semibold">
          {t('label.setting-plural')}
        </Typography>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content className="tw:py-6">
        {renderContent}
      </SlideoutMenu.Content>
      <SlideoutMenu.Footer>{drawerFooter}</SlideoutMenu.Footer>
    </SlideoutMenu>
  );
};

export default ProfilerSettingsModal;
