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
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  TreeSelect,
  Typography,
} from 'antd';
import Form from 'antd/lib/form';
import { FormProps, List } from 'antd/lib/form/Form';
import { Col, Row } from 'antd/lib/grid';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty, isEqual, isNil, isUndefined, pick, startCase } from 'lodash';
import React, {
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
  PROFILER_METRIC,
  PROFILER_MODAL_LABEL_STYLE,
  PROFILE_SAMPLE_OPTIONS,
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL,
  TIME_BASED_PARTITION,
} from '../../../../../constants/profiler.constant';
import { CSMode } from '../../../../../enums/codemirror.enum';
import {
  PartitionIntervalTypes,
  ProfileSampleType,
  TableProfilerConfig,
} from '../../../../../generated/entity/data/table';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../../../rest/tableAPI';
import { reducerWithoutAction } from '../../../../../utils/CommonUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';
import SliderWithInput from '../../../../common/SliderWithInput/SliderWithInput';
import SchemaEditor from '../../../SchemaEditor/SchemaEditor';
import '../table-profiler.less';
import {
  ProfilerForm,
  ProfilerSettingModalState,
  ProfilerSettingsModalProps,
} from '../TableProfiler.interface';

const ProfilerSettingsModal: React.FC<ProfilerSettingsModalProps> = ({
  tableId,
  columns,
  visible,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ProfilerForm>();

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
      partitionData: undefined,
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

  const selectOptions = useMemo(() => {
    return columns.map(({ name }) => ({
      label: name,
      value: name,
    }));
  }, [columns]);
  const metricsOptions = useMemo(() => {
    const metricsOptions = [
      {
        title: t('label.all'),
        value: 'all',
        key: 'all',
        children: PROFILER_METRIC.map((metric) => ({
          title: startCase(metric),
          value: metric,
          key: metric,
        })),
      },
    ];

    return metricsOptions;
  }, [columns]);

  const partitionIntervalType = Form.useWatch(['partitionIntervalType'], form);

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
      profileSample,
      profileSampleType,
      excludeColumns,
      sampleDataCount,
    } = tableProfilerConfig;
    handleStateChange({
      sqlQuery: profileQuery ?? '',
      profileSample: profileSample,
      excludeCol: excludeColumns ?? [],
      selectedProfileSampleType:
        profileSampleType ?? ProfileSampleType.Percentage,
      sampleDataCount,
    });
    form.setFieldsValue({
      sampleDataCount: sampleDataCount ?? initialState.sampleDataCount,
    });

    const profileSampleTypeCheck =
      profileSampleType === ProfileSampleType.Percentage;
    form.setFieldsValue({
      profileSampleType,
      profileSamplePercentage: profileSampleTypeCheck
        ? profileSample ?? 100
        : 100,
      profileSampleRows: !profileSampleTypeCheck
        ? profileSample ?? 100
        : undefined,
    });

    if (includeColumns && includeColumns?.length > 0) {
      const includeColValue = includeColumns.map((col) => {
        if (
          isUndefined(col.metrics) ||
          (col.metrics && col.metrics.length === 0)
        ) {
          col.metrics = ['all'];
        }

        return col;
      });
      form.setFieldsValue({ includeColumns: includeColValue });
      handleStateChange({
        includeCol: includeColValue,
      });
    }
    if (partitioning) {
      handleStateChange({
        enablePartition: partitioning.enablePartitioning || false,
      });

      form.setFieldsValue({
        ...partitioning,
      });
    }

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

  const getIncludesColumns = () => {
    const includeCols = state.includeCol.filter(
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

  const handleSave: FormProps['onFinish'] = useCallback(
    async (data) => {
      const {
        excludeCol,
        sqlQuery,
        includeCol,
        enablePartition,
        partitionData,
      } = state;

      setIsLoading(true);
      const {
        profileSamplePercentage,
        profileSampleRows,
        profileSampleType,
        sampleDataCount,
      } = data;

      const profileConfig: TableProfilerConfig = {
        excludeColumns: excludeCol.length > 0 ? excludeCol : undefined,
        profileQuery: !isEmpty(sqlQuery) ? sqlQuery : undefined,
        profileSample:
          profileSampleType === ProfileSampleType.Percentage
            ? profileSamplePercentage
            : profileSampleRows,
        profileSampleType: profileSampleType,
        includeColumns: !isEqual(includeCol, DEFAULT_INCLUDE_PROFILE)
          ? getIncludesColumns()
          : undefined,
        partitioning: enablePartition
          ? {
              ...partitionData,
              partitionValues:
                partitionIntervalType === PartitionIntervalTypes.ColumnValue
                  ? partitionData?.partitionValues?.filter(
                      (value) => !isEmpty(value)
                    )
                  : undefined,
              enablePartitioning: enablePartition,
            }
          : undefined,
        sampleDataCount,
      };
      try {
        const data = await putTableProfileConfig(tableId, profileConfig);
        if (data) {
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
    [state, getIncludesColumns]
  );

  const handleCancel = useCallback(() => {
    const { data } = state;
    data && updateInitialConfig(data);
    onVisibilityChange(false);
  }, [state]);

  const handleProfileSampleType = useCallback(
    (selectedProfileSampleType) =>
      handleStateChange({
        selectedProfileSampleType,
      }),
    []
  );

  const handleProfileSample = useCallback(
    (value) =>
      handleStateChange({
        profileSample: Number(value),
      }),
    []
  );

  const handleCodeMirrorChange = useCallback((value) => {
    handleStateChange({
      sqlQuery: value,
    });
  }, []);

  const handleIncludeColumnsProfiler = useCallback((changedValues, data) => {
    const { partitionIntervalType, enablePartitioning } = changedValues;
    if (partitionIntervalType || !isNil(enablePartitioning)) {
      form.setFieldsValue({
        partitionColumnName: undefined,
        partitionIntegerRangeStart: undefined,
        partitionIntegerRangeEnd: undefined,
        partitionIntervalUnit: undefined,
        partitionInterval: undefined,
        partitionValues: [''],
      });
    }
    if (!isNil(enablePartitioning)) {
      form.setFieldsValue({
        partitionIntervalType: undefined,
      });
    }

    handleStateChange({
      includeCol: data.includeColumns,
      partitionData: pick(
        data,
        'partitionColumnName',
        'partitionIntegerRangeEnd',
        'partitionIntegerRangeStart',
        'partitionInterval',
        'partitionIntervalType',
        'partitionIntervalUnit',
        'partitionValues'
      ),
    });
  }, []);

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
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      bodyStyle={{
        maxHeight: 600,
        overflowY: 'scroll',
      }}
      cancelButtonProps={{
        type: 'link',
      }}
      closable={false}
      confirmLoading={isLoading}
      data-testid="profiler-settings-modal"
      maskClosable={false}
      okButtonProps={{
        form: 'profiler-setting-form',
        htmlType: 'submit',
      }}
      okText={t('label.save')}
      open={visible}
      title={t('label.setting-plural')}
      width={630}
      onCancel={handleCancel}>
      {isDataLoading ? (
        <Loader />
      ) : (
        <Row gutter={[16, 16]}>
          <Col data-testid="profile-sample-container" span={24}>
            <Form
              data-testid="configure-ingestion-container"
              form={form}
              initialValues={{
                profileSampleType: state?.selectedProfileSampleType,
                profileSamplePercentage: state?.profileSample || 100,
                sampleDataCount: state.sampleDataCount,
              }}
              layout="vertical">
              <Form.Item
                label={t('label.profile-sample-type', {
                  type: '',
                })}
                name="profileSampleType">
                <Select
                  autoFocus
                  className="w-full"
                  data-testid="profile-sample"
                  options={PROFILE_SAMPLE_OPTIONS}
                  onChange={handleProfileSampleType}
                />
              </Form.Item>

              {state?.selectedProfileSampleType ===
              ProfileSampleType.Percentage ? (
                <Form.Item
                  className="m-b-0"
                  label={t('label.profile-sample-type', {
                    type: t('label.value'),
                  })}
                  name="profileSamplePercentage">
                  <SliderWithInput
                    className="p-x-xs"
                    value={state?.profileSample || 0}
                    onChange={handleProfileSample}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  className="m-b-0"
                  label={t('label.profile-sample-type', {
                    type: t('label.value'),
                  })}
                  name="profileSampleRows">
                  <InputNumber
                    className="w-full"
                    data-testid="metric-number-input"
                    min={0}
                    placeholder={t('label.please-enter-value', {
                      name: t('label.row-count-lowercase'),
                    })}
                  />
                </Form.Item>
              )}
              <Form.Item
                className="m-b-0"
                label={t('label.sample-data-count')}
                name="sampleDataCount">
                <InputNumber
                  className="w-full"
                  data-testid="sample-data-count-input"
                  min={0}
                  placeholder={t('label.please-enter-value', {
                    name: t('label.sample-data-count-lowercase'),
                  })}
                />
              </Form.Item>
            </Form>
          </Col>
          <Col data-testid="sql-editor-container" span={24}>
            <p className="m-b-xs">
              {t('label.profile-sample-type', {
                type: t('label.query'),
              })}{' '}
            </p>

            <SchemaEditor
              className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
              data-testid="profiler-setting-sql-editor"
              mode={{ name: CSMode.SQL }}
              options={{
                readOnly: false,
              }}
              value={state?.sqlQuery ?? ''}
              onChange={handleCodeMirrorChange}
            />
          </Col>
          <Col data-testid="exclude-column-container" span={24}>
            <Typography.Paragraph>
              {t('message.enable-column-profile')}
            </Typography.Paragraph>
            <p className="text-xs m-b-xss">{t('label.exclude')}:</p>
            <Select
              allowClear
              className="w-full"
              data-testid="exclude-column-select"
              mode="tags"
              options={selectOptions}
              placeholder={t('label.select-column-plural-to-exclude')}
              size="middle"
              value={state?.excludeCol}
              onChange={handleExcludeCol}
            />
          </Col>

          <Col span={24}>
            <Form
              autoComplete="off"
              form={form}
              id="profiler-setting-form"
              initialValues={{
                includeColumns: state?.includeCol,
                partitionData: [''],
                ...state?.data?.partitioning,
              }}
              layout="vertical"
              name="includeColumnsProfiler"
              onFinish={handleSave}
              onValuesChange={handleIncludeColumnsProfiler}>
              <List name="includeColumns">
                {(fields, { add, remove }) => (
                  <>
                    <div className="d-flex items-center m-b-xss">
                      <p className="w-form-label text-xs m-r-xs">
                        {`${t('label.include')}:`}
                      </p>
                      <Button
                        className="include-columns-add-button"
                        icon={<PlusOutlined />}
                        size="small"
                        type="primary"
                        onClick={() => add({ metrics: ['all'] })}
                      />
                    </div>
                    <div
                      className={classNames({
                        'h-max-40 overflow-y-auto':
                          state?.includeCol.length > 1,
                      })}
                      data-testid="include-column-container">
                      {fields.map(({ key, name, ...restField }) => (
                        <Row gutter={16} key={key}>
                          <Col span={12}>
                            <Form.Item
                              className="w-full m-b-md"
                              {...restField}
                              name={[name, 'columnName']}>
                              <Select
                                className="w-full"
                                data-testid="include-column-select"
                                options={selectOptions}
                                placeholder={t(
                                  'label.select-column-plural-to-include'
                                )}
                                size="middle"
                              />
                            </Form.Item>
                          </Col>
                          <Col className="flex" span={12}>
                            <Form.Item
                              className="w-full m-b-md"
                              {...restField}
                              name={[name, 'metrics']}>
                              <TreeSelect
                                treeCheckable
                                className="w-full"
                                maxTagCount={2}
                                placeholder={t('label.please-select')}
                                showCheckedStrategy="SHOW_PARENT"
                                treeData={metricsOptions}
                              />
                            </Form.Item>
                            <Button
                              icon={
                                <Icon
                                  className="align-middle"
                                  component={IconDelete}
                                  style={{ fontSize: '16px' }}
                                />
                              }
                              type="text"
                              onClick={() => remove(name)}
                            />
                          </Col>
                        </Row>
                      ))}
                    </div>
                  </>
                )}
              </List>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Space align="center" size={12}>
                    <p>{t('label.enable-partition')}</p>
                    <Form.Item className="m-b-0" name="enablePartitioning">
                      <Switch
                        checked={state?.enablePartition}
                        data-testid="enable-partition-switch"
                        onChange={handleEnablePartition}
                      />
                    </Form.Item>
                  </Space>
                </Col>
                <Col span={12}>
                  <Form.Item
                    className="m-b-0"
                    label={
                      <span className="text-xs">
                        {t('label.interval-type')}
                      </span>
                    }
                    labelCol={PROFILER_MODAL_LABEL_STYLE}
                    name="partitionIntervalType"
                    rules={[
                      {
                        required: state?.enablePartition,
                        message: t('message.field-text-is-required', {
                          fieldText: t('label.interval-type'),
                        }),
                      },
                    ]}>
                    <Select
                      allowClear
                      className="w-full"
                      data-testid="interval-type"
                      disabled={!state?.enablePartition}
                      options={INTERVAL_TYPE_OPTIONS}
                      placeholder={t('message.select-interval-type')}
                      size="middle"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    className="m-b-0"
                    label={
                      <span className="text-xs">
                        {t('label.column-entity', {
                          entity: t('label.name'),
                        })}
                      </span>
                    }
                    labelCol={PROFILER_MODAL_LABEL_STYLE}
                    name="partitionColumnName"
                    rules={[
                      {
                        required: state?.enablePartition,
                        message: t('message.field-text-is-required', {
                          fieldText: t('label.column-entity', {
                            entity: t('label.name'),
                          }),
                        }),
                      },
                    ]}>
                    <Select
                      allowClear
                      className="w-full"
                      data-testid="column-name"
                      disabled={!state?.enablePartition}
                      options={partitionColumnOptions}
                      placeholder={t('message.select-column-name')}
                      size="middle"
                    />
                  </Form.Item>
                </Col>
                {partitionIntervalType &&
                TIME_BASED_PARTITION.includes(partitionIntervalType) ? (
                  <>
                    <Col span={12}>
                      <Form.Item
                        className="m-b-0"
                        label={
                          <span className="text-xs">{t('label.interval')}</span>
                        }
                        labelCol={PROFILER_MODAL_LABEL_STYLE}
                        name="partitionInterval"
                        rules={[
                          {
                            required: state?.enablePartition,
                            message: t('message.field-text-is-required', {
                              fieldText: t('label.interval'),
                            }),
                          },
                        ]}>
                        <InputNumber
                          className="w-full"
                          data-testid="interval-required"
                          disabled={!state?.enablePartition}
                          placeholder={t('message.enter-interval')}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        className="m-b-0"
                        label={
                          <span className="text-xs">
                            {t('label.interval-unit')}
                          </span>
                        }
                        labelCol={PROFILER_MODAL_LABEL_STYLE}
                        name="partitionIntervalUnit"
                        rules={[
                          {
                            required: state?.enablePartition,
                            message: t('message.field-text-is-required', {
                              fieldText: t('label.interval-unit'),
                            }),
                          },
                        ]}>
                        <Select
                          allowClear
                          className="w-full"
                          data-testid="select-interval-unit"
                          disabled={!state?.enablePartition}
                          options={INTERVAL_UNIT_OPTIONS}
                          placeholder={t('message.select-interval-unit')}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}
                {PartitionIntervalTypes.IntegerRange ===
                partitionIntervalType ? (
                  <>
                    <Col span={12}>
                      <Form.Item
                        className="m-b-0"
                        label={
                          <span className="text-xs">
                            {t('label.start-entity', {
                              entity: t('label.range'),
                            })}
                          </span>
                        }
                        labelCol={PROFILER_MODAL_LABEL_STYLE}
                        name="partitionIntegerRangeStart"
                        rules={[
                          {
                            required: state?.enablePartition,
                            message: t('message.field-text-is-required', {
                              fieldText: t('label.start-entity', {
                                entity: t('label.range'),
                              }),
                            }),
                          },
                        ]}>
                        <InputNumber
                          className="w-full"
                          data-testid="start-range"
                          placeholder={t('message.enter-a-field', {
                            field: t('label.start-entity', {
                              entity: t('label.range'),
                            }),
                          })}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        className="m-b-0"
                        label={
                          <span className="text-xs">
                            {t('label.end-entity', {
                              entity: t('label.range'),
                            })}
                          </span>
                        }
                        labelCol={PROFILER_MODAL_LABEL_STYLE}
                        name="partitionIntegerRangeEnd"
                        rules={[
                          {
                            required: state?.enablePartition,
                            message: t('message.field-text-is-required', {
                              fieldText: t('label.end-entity', {
                                entity: t('label.range'),
                              }),
                            }),
                          },
                        ]}>
                        <InputNumber
                          className="w-full"
                          data-testid="end-range"
                          placeholder={t('message.enter-a-field', {
                            field: t('label.end-entity', {
                              entity: t('label.range'),
                            }),
                          })}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}

                {PartitionIntervalTypes.ColumnValue ===
                partitionIntervalType ? (
                  <Col span={24}>
                    <List name="partitionValues">
                      {(fields, { add, remove }) => (
                        <>
                          <div className="flex items-center m-b-xs">
                            <p className="w-form-label text-xs m-r-sm">
                              {`${t('label.value')}:`}
                            </p>
                            <Button
                              className="include-columns-add-button"
                              icon={<PlusOutlined />}
                              size="small"
                              type="primary"
                              onClick={() => add()}
                            />
                          </div>

                          {fields.map(({ key, name, ...restField }) => (
                            <Row gutter={16} key={key}>
                              <Col className="flex" span={24}>
                                <Form.Item
                                  className="w-full m-b-md"
                                  {...restField}
                                  name={name}
                                  rules={[
                                    {
                                      required: state?.enablePartition,
                                      message: t(
                                        'message.field-text-is-required',
                                        {
                                          fieldText: t('label.value'),
                                        }
                                      ),
                                    },
                                  ]}>
                                  <Input
                                    className="w-full"
                                    data-testid="partition-value"
                                    placeholder={t('message.enter-a-field', {
                                      field: t('label.value'),
                                    })}
                                  />
                                </Form.Item>
                                <Button
                                  icon={
                                    <Icon
                                      className="align-middle"
                                      component={IconDelete}
                                      style={{ fontSize: '16px' }}
                                    />
                                  }
                                  type="text"
                                  onClick={() => remove(name)}
                                />
                              </Col>
                            </Row>
                          ))}
                        </>
                      )}
                    </List>
                  </Col>
                ) : null}
              </Row>
            </Form>
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default ProfilerSettingsModal;
