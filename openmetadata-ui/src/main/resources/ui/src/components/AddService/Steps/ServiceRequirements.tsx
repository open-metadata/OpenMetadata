/*
 *  Copyright 2023 Collate.
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
import { Button, Col, Row } from 'antd';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMarkdownFile } from 'rest/miscAPI';

interface ServiceRequirementsProp {
  serviceName: string;
  serviceType: string;
  onCancel: () => void;
  onNext: () => void;
}

const ServiceRequirements: FC<ServiceRequirementsProp> = ({
  serviceType,
  serviceName,
  onCancel,
  onNext,
}) => {
  const { t, i18n } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [markdownContent, setMarkdownContent] = useState<string>('');

  const fetchRequirement = async () => {
    const filePath = `${i18n.language}/${serviceType}/${serviceName}/requirements.md`;

    setIsLoading(true);
    try {
      const response = await fetchMarkdownFile(filePath);

      setMarkdownContent(response);
    } catch (error) {
      setMarkdownContent('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirement();
  }, [serviceName, serviceType]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row data-testid="service-requirements">
      <Col span={24}>
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={markdownContent}
          maxLength={markdownContent.length}
        />
      </Col>
      <Col className="d-flex justify-end mt-12" span={24}>
        <Button
          className="m-r-xs"
          data-testid="previous-button"
          type="link"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>

        <Button
          className="font-medium p-x-md p-y-xxs h-auto rounded-6"
          data-testid="next-button"
          type="primary"
          onClick={onNext}>
          {t('label.next')}
        </Button>
      </Col>
    </Row>
  );
};

export default ServiceRequirements;
