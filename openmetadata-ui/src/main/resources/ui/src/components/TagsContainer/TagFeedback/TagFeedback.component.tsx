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

import { ExclamationCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { Button, Modal, Form, Select, Input, Tooltip, Tag, Space, Alert } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/entity/data/table';
import { RecognizerFeedback } from '../../../generated/type/recognizerFeedback';
import { postRecognizerFeedback } from '../../../rest/tagAPI';
import { showSuccessToast, showErrorToast } from '../../../utils/ToastUtils';
import { getCurrentUserId } from '../../../utils/UserUtils';

const { Option } = Select;
const { TextArea } = Input;

interface TagFeedbackProps {
  tag: TagLabel;
  entityLink: string;
  onFeedbackSubmitted?: () => void;
}

const TagFeedback: React.FC<TagFeedbackProps> = ({ 
  tag, 
  entityLink, 
  onFeedbackSubmitted 
}) => {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Only show feedback option for auto-applied tags
  if (!tag.autoApplied) {
    return null;
  }

  const handleReportClick = () => {
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      const feedback: RecognizerFeedback = {
        entityLink,
        tagFQN: tag.tagFQN,
        feedbackType: 'FALSE_POSITIVE',
        userReason: values.reason,
        userComments: values.comments,
        suggestedTag: values.suggestedTag,
        createdBy: {
          id: getCurrentUserId(),
          type: 'user'
        }
      };

      await postRecognizerFeedback(feedback);
      
      showSuccessToast(t('message.feedback-submitted-successfully'));
      setIsModalVisible(false);
      form.resetFields();
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (error) {
      showErrorToast(t('message.feedback-submission-failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip title={t('message.auto-applied-tag-help')}>
        <Space size={4}>
          <RobotOutlined style={{ fontSize: 10, color: '#1890ff' }} />
          <Button 
            type="link" 
            size="small" 
            icon={<ExclamationCircleOutlined />}
            onClick={handleReportClick}
            style={{ padding: 0, height: 'auto' }}>
            {t('label.report')}
          </Button>
        </Space>
      </Tooltip>

      <Modal
        title={t('label.report-incorrect-tag')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={form.submit}
        confirmLoading={isSubmitting}
        width={600}>
        
        <Alert
          message={t('message.tag-feedback-explanation')}
          description={t('message.tag-feedback-help-text')}
          type="info"
          showIcon
          className="mb-md"
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}>
          
          <Form.Item label={t('label.current-tag')} className="mb-sm">
            <Tag color={tag.style?.color}>
              {tag.tagFQN}
            </Tag>
          </Form.Item>

          <Form.Item
            name="reason"
            label={t('label.why-incorrect')}
            rules={[{ required: true, message: t('message.please-select-reason') }]}>
            <Select placeholder={t('label.select-reason')}>
              <Option value="NOT_SENSITIVE_DATA">
                {t('label.not-sensitive-data')}
              </Option>
              <Option value="WRONG_DATA_TYPE">
                {t('label.wrong-data-type')}
              </Option>
              <Option value="INTERNAL_IDENTIFIER">
                {t('label.internal-identifier')}
              </Option>
              <Option value="PUBLIC_INFORMATION">
                {t('label.public-information')}
              </Option>
              <Option value="TEST_DATA">
                {t('label.test-data')}
              </Option>
              <Option value="ENCRYPTED_DATA">
                {t('label.already-encrypted')}
              </Option>
              <Option value="OTHER">
                {t('label.other')}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="comments"
            label={t('label.additional-context')}
            extra={t('message.help-us-improve-detection')}>
            <TextArea 
              rows={3} 
              placeholder={t('placeholder.explain-why-tag-incorrect')}
            />
          </Form.Item>

          <Form.Item
            name="suggestedTag"
            label={t('label.suggested-tag-optional')}>
            <Input placeholder={t('placeholder.suggest-correct-tag')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default TagFeedback;