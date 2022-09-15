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
import { Button, InputNumber, Modal, Select, Slider, TreeSelect } from 'antd';
import Form from 'antd/lib/form';
import { List } from 'antd/lib/form/Form';
import { Col, Row } from 'antd/lib/grid';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/fold/foldgutter.css';
import { isEmpty, isEqual, isUndefined, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../axiosAPIs/tableAPI';
import {
  codeMirrorOption,
  DEFAULT_INCLUDE_PROFILE,
  PROFILER_METRIC,
} from '../../../constants/profiler.constant';
import {
  ColumnProfilerConfig,
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
  const [data, setData] = useState<TableProfilerConfig>();
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [profileSample, setProfileSample] = useState<number>(100);
  const [excludeCol, setExcludeCol] = useState<string[]>([]);
  const [includeCol, setIncludeCol] = useState<ColumnProfilerConfig[]>(
    DEFAULT_INCLUDE_PROFILE
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
        title: 'All',
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

  const updateInitialConfig = (tableProfilerConfig: TableProfilerConfig) => {
    const { includeColumns } = tableProfilerConfig;
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
      setIncludeCol(includeColValue);
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
    const profileConfig: TableProfilerConfig = {
      excludeColumns: excludeCol.length > 0 ? excludeCol : undefined,
      profileQuery: !isEmpty(sqlQuery) ? sqlQuery : undefined,
      profileSample: !isUndefined(profileSample) ? profileSample : undefined,
      includeColumns: !isEqual(includeCol, DEFAULT_INCLUDE_PROFILE)
        ? getIncludesColumns()
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
      cancelButtonProps={{
        type: 'link',
      }}
      data-testid="profiler-settings-modal"
      maskClosable={false}
      okText="Save"
      title="Settings"
      visible={visible}
      width={630}
      onCancel={handleCancel}
      onOk={handleSave}>
      <Row gutter={[16, 16]}>
        <Col data-testid="profile-sample-container" span={24}>
          <p>Profile Sample %</p>
          <div className="tw-px-2 tw-mb-1.5">
            <Row gutter={20}>
              <Col span={20}>
                <Slider
                  className="profiler-slider"
                  marks={{
                    0: '0%',
                    100: '100%',
                    [profileSample as number]: `${profileSample}%`,
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
                    setProfileSample(value);
                  }}
                />
              </Col>
            </Row>
          </div>
        </Col>
        <Col data-testid="sql-editor-container" span={24}>
          <p className="tw-mb-1.5">Profile Sample Query</p>
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
          <p className="tw-mb-4">Enable column profile</p>
          <p className="tw-text-xs tw-mb-1.5">Exclude:</p>
          <Select
            allowClear
            className="tw-w-full"
            data-testid="exclude-column-select"
            mode="tags"
            options={selectOptions}
            placeholder="Select columns to exclude"
            size="middle"
            value={excludeCol}
            onChange={(value) => setExcludeCol(value)}
          />
        </Col>

        <Col span={24}>
          <Form
            autoComplete="off"
            initialValues={{
              includeColumns: includeCol,
            }}
            layout="vertical"
            name="includeColumnsProfiler"
            onValuesChange={(_, data) => {
              setIncludeCol(data.includeColumns);
            }}>
            <List name="includeColumns">
              {(fields, { add, remove }) => (
                <>
                  <div className="tw-flex tw-items-center tw-mb-1.5">
                    <p className="w-form-label tw-text-xs tw-mr-3">Include:</p>
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
                      'tw-h-40 tw-overflow-auto': includeCol.length > 1,
                    })}
                    data-testid="include-column-container">
                    {fields.map(({ key, name, ...restField }) => (
                      <div className="tw-flex tw-gap-2 tw-w-full" key={key}>
                        <Form.Item
                          className="tw-w-11/12 tw-mb-4"
                          {...restField}
                          name={[name, 'columnName']}>
                          <Select
                            className="tw-w-full"
                            data-testid="exclude-column-select"
                            options={selectOptions}
                            placeholder="Select columns to include"
                            size="middle"
                          />
                        </Form.Item>
                        <Form.Item
                          className="tw-w-11/12 tw-mb-4"
                          {...restField}
                          name={[name, 'metrics']}>
                          <TreeSelect
                            treeCheckable
                            className="tw-w-full"
                            maxTagCount={2}
                            placeholder="Please select"
                            showCheckedStrategy="SHOW_PARENT"
                            treeData={metricsOptions}
                          />
                        </Form.Item>
                        <Button
                          icon={
                            <SVGIcons
                              alt="delete"
                              className="tw-w-4"
                              icon={Icons.DELETE}
                            />
                          }
                          type="text"
                          onClick={() => remove(name)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </List>
          </Form>
        </Col>
      </Row>
    </Modal>
  );
};

export default ProfilerSettingsModal;
