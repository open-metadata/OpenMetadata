import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import { getAxiosErrorMessage } from '../utils/AxiosUtils';
import { Button, Col, Form, Input, Row, Typography } from 'antd';
import BrandImage from '../components/common/BrandImage/BrandImage';

const LandingPage = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [ingestionToken, setIngestionToken] = useState('');
  const history = useHistory();

  const handleSubmit = async (values: any) => {
    try {
      const response = await axios.post('/init', {
        server_url: values.serverUrl,
        token: values.ingestionToken,
      });

      history.push('/service');
    } catch (error) {
      alert(getAxiosErrorMessage(error));
    }
  };


  return (
    <Row className="h-full">
      <Col className="bg-white" span={24}>
        <div
          className='mt-24 text-left flex flex-col items-start px-10'>
          <BrandImage height="auto" width={200} />
          <Typography.Text className="mt-8 w-180 text-xl font-medium text-grey-muted">
            Welcome to the Ingestion Server!{' '}
          </Typography.Text>
          <Typography.Text className="mt-4 w-480 text-xl font-medium text-grey-muted">
            Here you can easily prepare the configurations to start ingesting metadata externally!{' '}
          </Typography.Text>
          <Typography.Text className="mt-4 mb-4 w-480 text-xl font-medium text-grey-muted">
            In order to move on, please provide the following information:{' '}
          </Typography.Text>
        </div>
      </Col>
      <Col span={24}>
        <Form
          className="pt-8"
          name="basic"
          labelCol={{ span: 7 }}
          wrapperCol={{ span: 14 }}
          onFinish={handleSubmit}
          autoComplete="off"
          style={{ maxWidth: '600px', margin: '0 auto' }}
        >
          <Form.Item
            label="OpenMetadata URL"
            name="serverUrl"
            labelAlign="left"
            className="ml-4"
            rules={[{ required: true, message: 'Please input the server URL' }]}
          >
            <Input placeholder="http://localhost:8585/api" />
          </Form.Item>

          <Form.Item
            label="Ingestion Bot Token"
            name="ingestionToken"
            labelAlign="left"
            className="ml-4"
            rules={[{ required: true, message: 'Please input the ingestion token' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
            <Button type="primary" htmlType="submit">
              Create ingestion
            </Button>
          </Form.Item>
        </Form >
      </Col>
    </Row>

  );
};

export default LandingPage;