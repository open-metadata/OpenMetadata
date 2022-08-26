import { Col, Form, Row, TreeSelect } from 'antd';
import Checkbox from 'antd/lib/checkbox/Checkbox';
import { Store } from 'antd/lib/form/interface';
import { startCase } from 'lodash';
import React, { useMemo } from 'react';
import {
  EventFilter,
  EventType,
} from '../../generated/api/events/createWebhook';
import { Entities } from './WebhookConstants';

interface SelectComponentProps {
  eventFilterFormData: Store;
  setEventFilterFormData: (formData: EventFilter[]) => void;
}
const SelectComponent = ({
  eventFilterFormData,
  setEventFilterFormData,
}: SelectComponentProps) => {
  const metricsOptions = useMemo(
    () => [
      {
        title: 'All',
        value: 'all',
        key: 'all',
        children: Object.values(EventType).map((metric) => ({
          title: startCase(metric),
          value: metric,
          key: metric,
        })),
      },
    ],
    []
  );

  return (
    <Form
      autoComplete="off"
      initialValues={eventFilterFormData}
      layout="vertical"
      onValuesChange={(_, data) => {
        setEventFilterFormData(data);
      }}>
      <Row gutter={16}>
        {Object.keys(Entities).map((key) => {
          const value = Entities[key];

          return (
            <Col key={key} span={12}>
              <Form.Item
                name={key}
                style={{ marginBottom: 4 }}
                valuePropName="checked">
                <Checkbox>{value}</Checkbox>
              </Form.Item>
              <Form.Item name={`${key}-tree`} style={{ marginBottom: 8 }}>
                <TreeSelect
                  treeCheckable
                  disabled={!eventFilterFormData[key]}
                  maxTagCount={2}
                  placeholder="Please select"
                  showCheckedStrategy="SHOW_PARENT"
                  treeData={metricsOptions}
                />
              </Form.Item>
            </Col>
          );
        })}
      </Row>
    </Form>
  );
};

export default SelectComponent;
