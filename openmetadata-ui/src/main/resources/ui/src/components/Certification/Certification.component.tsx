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
import { isEmpty } from 'lodash';
import React, { useState } from 'react';
import { ReactComponent as AssigneesIcon } from '../../assets/svg/ic-assignees.svg';
import { Tag } from '../../generated/entity/classification/tag';
import { getTags } from '../../rest/tagAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getTagImageSrc } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { EditIconButton } from '../common/IconButtons/EditIconButton';
import Loader from '../common/Loader/Loader';
import { CardWithListItems } from '../common/TierCard/TierCard.interface';
import './certification.less';
const Certification = ({
  label,
  value,
  dataTestId,
  permission,
  currentCertificate,
  onCertificationUpdate,
}: {
  label: string;
  value: string | number | React.ReactNode;
  dataTestId?: string;
  inlineLayout?: boolean;
  permission: boolean;
  onCertificationUpdate?: (certification?: Tag) => Promise<void>;
  currentCertificate?: string;
}) => {
  const [isLoadingCertificationData, setIsLoadingCertificationData] =
    useState<boolean>(false);
  const [certifications, setCertifications] = useState<Array<Tag>>([]);
  const [certificationCardData, setCertificationCardData] = useState<
    Array<CardWithListItems>
  >([]);
  const [selectedCertification, setSelectedCertification] = useState<{
    id?: string;
    title?: string;
  }>({ title: currentCertificate });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

      if (data) {
        const certificationData: CardWithListItems[] =
          data.map((cert) => ({
            id: cert.fullyQualifiedName || '',
            title: getEntityName(cert),
            description: cert.description
              ? cert.description.indexOf('\n\n') > -1
                ? cert.description.substring(
                    0,
                    cert.description.indexOf('\n\n')
                  )
                : cert.description
              : '',
            data: cert.description
              ? cert.description.indexOf('\n\n') > -1
                ? cert.description.substring(
                    cert.description.indexOf('\n\n') + 1
                  )
                : ''
              : '',
            style: cert.style,
          })) ?? [];
        setCertificationCardData(certificationData);
        setCertifications(data);
      } else {
        setCertificationCardData([]);
      }
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
    setSelectedCertification({ title: currentCertificate });
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
            <Radio.Group
              value={selectedCertification.id ?? selectedCertification.title}>
              {certificationCardData.map((card) => {
                const tagSrc = getTagImageSrc(card.style?.iconURL || '');

                return (
                  <div
                    className="certification-card-item"
                    key={card.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedCertification({
                        id: card.id,
                        title: card.title,
                      });
                    }}>
                    <Radio
                      className="certification-radio-top-right"
                      data-testid={`radio-btn-${card.title}`}
                      value={card.id}
                    />
                    <div className="certification-card-content">
                      {tagSrc && <img alt={card.title} src={tagSrc} />}
                      <div>
                        <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-body">
                          {card.title}
                        </Typography.Paragraph>
                        <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-muted">
                          {card.description.replace(/\*/g, '')}
                        </Typography.Paragraph>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Radio.Group>
            <div className="flex justify-end text-lg gap-2 mt-4">
              <Button type="default" onClick={handleCloseCertification}>
                <CloseOutlined />
              </Button>
              <Button
                type="primary"
                onClick={() =>
                  updateCertificationData(selectedCertification.id)
                }>
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
      <div className="d-flex align-start extra-info-container">
        <Typography.Text
          className="whitespace-nowrap text-sm d-flex flex-col gap-2"
          data-testid={dataTestId}>
          <div className="flex gap-2">
            {!isEmpty(label) && (
              <span className="extra-info-label-heading">{label}</span>
            )}
            {permission && (
              <EditIconButton
                newLook
                data-testid="edit-certification"
                size="small"
                title={t('label.edit-entity', {
                  entity: t('label.certification'),
                })}
              />
            )}
          </div>
          <div className="font-medium certification-value">{value}</div>
        </Typography.Text>
      </div>
    </Popover>
  );
};

export default Certification;
