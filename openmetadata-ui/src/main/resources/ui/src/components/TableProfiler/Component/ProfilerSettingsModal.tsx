/*
 *  Copyright 2022 Collate
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
import {
  Button,
  InputNumber,
  Modal,
  Select,
  Slider,
  Space,
  Switch,
  TreeSelect,
} from 'antd';
import Form from 'antd/lib/form';
import { List } from 'antd/lib/form/Form';
import { Col, Row } from 'antd/lib/grid';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty, isEqual, isUndefined, omit, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { useTranslation } from 'react-i18next';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../axiosAPIs/tableAPI';
import {
  codeMirrorOption,
  DEFAULT_INCLUDE_PROFILE,
  INTERVAL_TYPE_OPTIONS,
  INTERVAL_UNIT_OPTIONS,
  PROFILER_METRIC,
  SUPPORTED_PARTITION_TYPE,
} from '../../../constants/profiler.constant';
import {
  ColumnProfilerConfig,
  PartitionProfilerConfig,
  TableProfilerConfig,
} from '../../../generated/entity/data/table';
import jsonData from '../../../jsons/en';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import '../tableProfiler.less';

const ProfilerSettingsModal: React.FC<ProfilerSettingsModalProps> = ({
  tableId,
  columns,
  visible,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [data, setData] = useState<TableProfilerConfig>();
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [profileSample, setProfileSample] = useState<number>(100);
  const [excludeCol, setExcludeCol] = useState<string[]>([]);
  const [includeCol, setIncludeCol] = useState<ColumnProfilerConfig[]>(
    DEFAULT_INCLUDE_PROFILE
  );
  const [isLoading, setIsLoading] = useState(false);

  const [enablePartition, setEnablePartition] = useState(false);
  const [partitionData, setPartitionData] = useState<PartitionProfilerConfig>();

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

  const { partitionColumnOptions, isPartitionDisabled } = useMemo(() => {
    const partitionColumnOptions = columns.reduce((result, column) => {
      if (SUPPORTED_PARTITION_TYPE.includes(column.dataType)) {
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
    const isPartitionDisabled = partitionColumnOptions.length === 0;

    return {
      partitionColumnOptions,
      isPartitionDisabled,
    };
  }, [columns]);

  const updateInitialConfig = (tableProfilerConfig: TableProfilerConfig) => {
    const { includeColumns, partitioning } = tableProfilerConfig;
    setSqlQuery(tableProfilerConfig.profileQuery || '');
    setProfileSample(tableProfilerConfig.profileSample || 100);
    setExcludeCol(tableProfilerConfig.excludeColumns || []);
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
      setIncludeCol(includeColValue);
    }
    if (partitioning) {
      setEnablePartition(partitioning.enablePartitioning || false);
      form.setFieldsValue({ ...partitioning });
    }
  };

  const fetchProfileConfig = async () => {
    try {
      const response = await getTableProfilerConfig(tableId);
      if (response) {
        const { tableProfilerConfig } = response;
        if (tableProfilerConfig) {
          setData(tableProfilerConfig);
          updateInitialConfig(tableProfilerConfig);
        }
      } else {
        throw jsonData['api-error-messages'][
          'fetch-table-profiler-config-error'
        ];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-table-profiler-config-error']
      );
    }
  };

  const getIncludesColumns = () => {
    const includeCols = includeCol.filter(
      ({ columnName }) => !isUndefined(columnName)
    );
    setIncludeCol(includeCols);

    return includeCols.map((col) => {
      if (col.metrics && col.metrics[0] === 'all') {
        return {
          columnName: col.columnName,
        };
      }

      return col;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    const profileConfig: TableProfilerConfig = {
      excludeColumns: excludeCol.length > 0 ? excludeCol : undefined,
      profileQuery: !isEmpty(sqlQuery) ? sqlQuery : undefined,
      profileSample: !isUndefined(profileSample) ? profileSample : undefined,
      includeColumns: !isEqual(includeCol, DEFAULT_INCLUDE_PROFILE)
        ? getIncludesColumns()
        : undefined,
      partitioning: enablePartition
        ? {
            ...partitionData,
            enablePartitioning: enablePartition,
          }
        : undefined,
    };
    try {
      const data = await putTableProfileConfig(tableId, profileConfig);
      if (data) {
        showSuccessToast(
          jsonData['api-success-messages']['update-profile-congif-success']
        );
        onVisibilityChange(false);
      } else {
        throw jsonData['api-error-messages']['update-profiler-config-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-profiler-config-error']
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    data && updateInitialConfig(data);
    onVisibilityChange(false);
  };

  useEffect(() => {
    fetchProfileConfig();
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
      title={t('label.settings')}
      visible={visible}
      width={630}
      onCancel={handleCancel}>
      <Row gutter={[16, 16]}>
        <Col data-testid="profile-sample-container" span={24}>
          <p>{t('label.profile-sample-percentage')}</p>
          <div className="tw-px-2 tw-mb-1.5">
            <Row gutter={20}>
              <Col span={20}>
                <Slider
                  className="profiler-slider"
                  marks={{
                    0: '0%',
                    100: '100%',
                  }}
                  max={100}
                  min={0}
                  tooltipPlacement="bottom"
                  tooltipVisible={false}
                  value={profileSample}
                  onChange={(value) => {
                    setProfileSample(value);
                  }}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  formatter={(value) => `${value}%`}
                  max={100}
                  min={0}
                  step={1}
                  value={profileSample}
                  onChange={(value) => {
                    setProfileSample(Number(value));
                  }}
                />
              </Col>
            </Row>
          </div>
        </Col>
        <Col data-testid="sql-editor-container" span={24}>
          <p className="tw-mb-1.5">{t('label.profile-sample-query')} </p>
          <CodeMirror
            className="profiler-setting-sql-editor"
            data-testid="profiler-setting-sql-editor"
            options={codeMirrorOption}
            value={sqlQuery}
            onBeforeChange={(_Editor, _EditorChange, value) => {
              setSqlQuery(value);
            }}
            onChange={(_Editor, _EditorChange, value) => {
              setSqlQuery(value);
            }}
          />
        </Col>
        <Col data-testid="exclude-column-container" span={24}>
          <p className="tw-mb-4">{t('label.enable-column-profile')}</p>
          <p className="tw-text-xs tw-mb-1.5">{t('label.exclude')}:</p>
          <Select
            allowClear
            className="tw-w-full"
            data-testid="exclude-column-select"
            mode="tags"
            options={selectOptions}
            placeholder={t('label.select-column-exclude')}
            size="middle"
            value={excludeCol}
            onChange={(value) => setExcludeCol(value)}
          />
        </Col>

        <Col span={24}>
          <Form
            autoComplete="off"
            form={form}
            id="profiler-setting-form"
            initialValues={{
              includeColumns: includeCol,
              ...data?.partitioning,
            }}
            layout="vertical"
            name="includeColumnsProfiler"
            onFinish={handleSave}
            onValuesChange={(_, data) => {
              setIncludeCol(data.includeColumns);
              setPartitionData(omit(data, 'includeColumns'));
            }}>
            <List name="includeColumns">
              {(fields, { add, remove }) => (
                <>
                  <div className="tw-flex tw-items-center tw-mb-1.5">
                    <p className="w-form-label tw-text-xs tw-mr-3">
                      {t('label.include')}:
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
                      'tw-max-h-40 tw-overflow-y-auto': includeCol.length > 1,
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
                              data-testid="exclude-column-select"
                              options={selectOptions}
                              placeholder={t('label.select-column-include')}
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
                              <SVGIcons
                                alt={t('label.delete')}
                                className="w-4"
                                icon={Icons.DELETE}
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
            <Form.Item className="m-b-xs">
              <Space size={12}>
                <p>{t('label.enable-partition')}</p>
                <Switch
                  checked={enablePartition}
                  data-testid="enable-partition-switch"
                  disabled={isPartitionDisabled}
                  onChange={(value) => setEnablePartition(value)}
                />
              </Space>
            </Form.Item>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Form.Item
                  className="m-b-0"
                  label={
                    <span className="text-xs">{t('label.column-name')}</span>
                  }
                  labelCol={{
                    style: {
                      paddingBottom: 8,
                    },
                  }}
                  name="partitionColumnName"
                  rules={[
                    {
                      required: isPartitionDisabled || enablePartition,
                      message: t('message.column-name-required'),
                    },
                  ]}>
                  <Select
                    allowClear
                    className="w-full"
                    data-testid="column-name"
                    disabled={isPartitionDisabled || !enablePartition}
                    options={partitionColumnOptions}
                    placeholder={t('message.select-column-name')}
                    size="middle"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  className="m-b-0"
                  label={
                    <span className="text-xs">{t('label.interval-type')}</span>
                  }
                  labelCol={{
                    style: {
                      paddingBottom: 8,
                    },
                  }}
                  name="partitionIntervalType"
                  rules={[
                    {
                      required: isPartitionDisabled || enablePartition,
                      message: t('message.interval-type-required'),
                    },
                  ]}>
                  <Select
                    allowClear
                    className="w-full"
                    data-testid="interval-type"
                    disabled={isPartitionDisabled || !enablePartition}
                    options={INTERVAL_TYPE_OPTIONS}
                    placeholder={t('message.select-type-required')}
                    size="middle"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  className="m-b-0"
                  label={<span className="text-xs">{t('label.interval')}</span>}
                  labelCol={{
                    style: {
                      paddingBottom: 8,
                    },
                  }}
                  name="partitionInterval"
                  rules={[
                    {
                      required: isPartitionDisabled || enablePartition,
                      message: t('message.interval-required'),
                    },
                  ]}>
                  <InputNumber
                    className="w-full"
                    data-testid="interval-required"
                    disabled={isPartitionDisabled || !enablePartition}
                    placeholder={t('message.enter-interval')}
                    size="middle"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  className="m-b-0"
                  label={
                    <span className="text-xs">{t('label.interval-unit')}</span>
                  }
                  labelCol={{
                    style: {
                      paddingBottom: 8,
                    },
                  }}
                  name="partitionIntervalUnit"
                  rules={[
                    {
                      required: isPartitionDisabled || enablePartition,
                      message: t('message.interval-unit-required'),
                    },
                  ]}>
                  <Select
                    allowClear
                    className="w-full"
                    data-testid="select-interval-unit"
                    disabled={isPartitionDisabled || !enablePartition}
                    options={INTERVAL_UNIT_OPTIONS}
                    placeholder={t('message.select-interval-unit')}
                    size="middle"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Col>
      </Row>
    </Modal>
  );
};

export default ProfilerSettingsModal;
