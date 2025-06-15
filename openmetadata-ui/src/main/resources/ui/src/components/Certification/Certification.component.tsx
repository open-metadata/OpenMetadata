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
import Icon, { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, Popover, Radio, Space, Spin, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import React, { useMemo, useState } from 'react';
import { ReactComponent as AssigneesIcon } from '../../assets/svg/ic-assignees.svg';
import { Tag } from '../../generated/entity/classification/tag';
import { getTags } from '../../rest/tagAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getTagImageSrc } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import { CertificationProps } from './Certification.interface';
import './certification.less';
const Certification = ({
  currentCertificate = '',
  children,
  onCertificationUpdate,
}: CertificationProps) => {
  const [isLoadingCertificationData, setIsLoadingCertificationData] =
    useState<boolean>(false);
  const [certifications, setCertifications] = useState<Array<Tag>>([]);
  const [selectedCertification, setSelectedCertification] =
    useState<string>('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const certificationCardData = useMemo(() => {
    return (
      <Radio.Group value={selectedCertification}>
        {certifications.map((certificate) => {
          const tagSrc = getTagImageSrc(certificate.style?.iconURL ?? '');
          const title = getEntityName(certificate);
          const { id, fullyQualifiedName, description } = certificate;

          return (
            <div
              className="certification-card-item cursor-pointer"
              key={id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedCertification(fullyQualifiedName ?? '');
              }}>
              <Radio
                className="certification-radio-top-right"
                data-testid={`radio-btn-${title}`}
                value={fullyQualifiedName}
              />
              <div className="certification-card-content">
                {tagSrc && <img alt={title} src={tagSrc} />}
                <div>
                  <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-body">
                    {title}
                  </Typography.Paragraph>
                  <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-muted">
                    {description.replace(/\*/g, '')}
                  </Typography.Paragraph>
                </div>
              </div>
            </div>
          );
        })}
      </Radio.Group>
    );
  }, [certifications, selectedCertification]);

  const updateCertificationData = async (value?: string) => {
    setIsLoadingCertificationData(true);
    const certification = certifications.find(
      (cert) => cert.fullyQualifiedName === value
    );
    await onCertificationUpdate?.(certification);
    setIsLoadingCertificationData(false);
    setIsPopoverOpen(false);
  };
  const getCertificationData = async () => {
    setIsLoadingCertificationData(true);
    try {
      const { data } = await getTags({
        parent: 'Certification',
        limit: 50,
      });
      setCertifications(data);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.certification-plural-lowercase'),
        })
      );
    } finally {
      setIsLoadingCertificationData(false);
    }
  };

  const handleCloseCertification = async () => {
    setSelectedCertification(currentCertificate);
    setIsPopoverOpen(false);
  };

  return (
    <Popover
      className="p-0"
      content={
        <Card
          bordered={false}
          className="certification-card"
          data-testid="certification-cards"
          title={
            <Space className="w-full justify-between">
              <div className="flex gap-2 items-center w-full">
                <Icon className="text-lg" component={AssigneesIcon} />
                <Typography.Text className="m-b-0 font-semibold text-sm">
                  {t('label.edit-entity', { entity: t('label.certification') })}
                </Typography.Text>
              </div>
              <Typography.Text
                className="m-b-0 font-semibold text-primary text-sm cursor-pointer"
                data-testid="clear-certification"
                onClick={() => updateCertificationData()}>
                {t('label.clear')}
              </Typography.Text>
            </Space>
          }>
          <Spin
            indicator={<Loader size="small" />}
            spinning={isLoadingCertificationData}>
            {certificationCardData}
            <div className="flex justify-end text-lg gap-2 mt-4">
              <Button type="default" onClick={handleCloseCertification}>
                <CloseOutlined />
              </Button>
              <Button
                type="primary"
                onClick={() => updateCertificationData(selectedCertification)}>
                <CheckOutlined />
              </Button>
            </div>
          </Spin>
        </Card>
      }
      open={isPopoverOpen}
      overlayClassName="certification-card-popover"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={(visible) => {
        setIsPopoverOpen(visible);
        visible && getCertificationData();
      }}>
      {children}
    </Popover>
  );
};

export default Certification;
