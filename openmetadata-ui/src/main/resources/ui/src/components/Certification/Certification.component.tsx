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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, Popover, Radio, Space, Spin, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CertificationIcon } from '../../assets/svg/ic-certification.svg';
import { Tag } from '../../generated/entity/classification/tag';
import { Paging } from '../../generated/type/paging';
import { getTags } from '../../rest/tagAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { getTagImageSrc } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { FocusTrapWithContainer } from '../common/FocusTrap/FocusTrapWithContainer';
import Loader from '../common/Loader/Loader';
import { CertificationProps } from './Certification.interface';
import './certification.less';

const Certification = ({
  currentCertificate = '',
  children,
  onCertificationUpdate,
  popoverProps,
  onClose,
}: CertificationProps) => {
  const { t } = useTranslation();
  const popoverRef = useRef<{ close: () => void } | null>(null);
  const [isLoadingCertificationData, setIsLoadingCertificationData] =
    useState<boolean>(false);
  const [hasContentLoading, setHasContentLoading] = useState<boolean>(false);
  const [certifications, setCertifications] = useState<Array<Tag>>([]);
  const [selectedCertification, setSelectedCertification] = useState<string>(
    currentCertificate ?? ''
  );
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);

  const getCertificationData = async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoadingCertificationData(true);
    } else {
      setHasContentLoading(true);
    }

    try {
      const response = await getTags({
        parent: 'Certification',
        limit: 50,
        after: page > 1 ? paging.after : undefined,
      });

      const { data, paging: newPaging } = response;

      // Sort certifications with Gold, Silver, Bronze first (only for initial load)
      const sortedData =
        page === 1
          ? [...data].sort((a, b) => {
              const order: Record<string, number> = {
                Gold: 0,
                Silver: 1,
                Bronze: 2,
              };

              const aName = getEntityName(a);
              const bName = getEntityName(b);

              const aOrder = order[aName] ?? 3;
              const bOrder = order[bName] ?? 3;

              return aOrder - bOrder;
            })
          : data;

      if (append) {
        setCertifications((prev) => [...prev, ...sortedData]);
      } else {
        setCertifications(sortedData);
      }

      setPaging(newPaging);
      setCurrentPage(page);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.certification-plural-lowercase'),
        })
      );
    } finally {
      setIsLoadingCertificationData(false);
      setHasContentLoading(false);
    }
  };

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    const isAtBottom =
      currentTarget.scrollTop + currentTarget.offsetHeight >=
      currentTarget.scrollHeight - 1; // -1 for precision tolerance

    if (isAtBottom && paging.after && !hasContentLoading) {
      await getCertificationData(currentPage + 1, true);
    }
  };

  const updateCertificationData = async (value?: string) => {
    setIsLoadingCertificationData(true);
    const certification = certifications.find(
      (cert) => cert.fullyQualifiedName === value
    );
    await onCertificationUpdate?.(certification);
    setIsLoadingCertificationData(false);
    popoverRef.current?.close();
  };

  const certificationCardData = useMemo(() => {
    return (
      <div
        className="h-max-100 overflow-y-auto overflow-x-hidden"
        onScroll={handleScroll}>
        <Radio.Group className="w-full" value={selectedCertification}>
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
                  data-testid={`radio-btn-${fullyQualifiedName}`}
                  value={fullyQualifiedName}
                />
                <div className="certification-card-content">
                  {tagSrc ? (
                    <img alt={title} src={tagSrc} />
                  ) : (
                    <div className="certification-icon">
                      <CertificationIcon height={28} width={28} />
                    </div>
                  )}
                  <div>
                    <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-body">
                      {title}
                    </Typography.Paragraph>
                    <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-muted">
                      {stringToHTML(description)}
                    </Typography.Paragraph>
                  </div>
                </div>
              </div>
            );
          })}
        </Radio.Group>
        {hasContentLoading && (
          <div className="flex justify-center p-2">
            <Loader size="small" />
          </div>
        )}
      </div>
    );
  }, [certifications, selectedCertification, hasContentLoading, handleScroll]);

  const handleCloseCertification = async () => {
    popoverRef.current?.close();
    onClose?.();
  };

  const onOpenChange = (visible: boolean) => {
    if (visible) {
      getCertificationData(1);
      setSelectedCertification(currentCertificate);
      setCurrentPage(1);
      setPaging({} as Paging);
    } else {
      setSelectedCertification('');
      setCertifications([]);
    }
  };

  useEffect(() => {
    if (popoverProps?.open && certifications.length === 0) {
      getCertificationData(1);
    }
  }, [popoverProps?.open]);

  return (
    <Popover
      content={
        <FocusTrapWithContainer active={popoverProps?.open || false}>
          <Card
            bordered={false}
            className="certification-card"
            data-testid="certification-cards"
            title={
              <Space className="w-full justify-between">
                <div className="flex gap-2 items-center w-full">
                  <CertificationIcon height={18} width={18} />
                  <Typography.Text className="m-b-0 font-semibold text-sm">
                    {t('label.edit-entity', {
                      entity: t('label.certification'),
                    })}
                  </Typography.Text>
                </div>
                <Typography.Text
                  className="m-b-0 font-semibold text-primary text-sm cursor-pointer"
                  data-testid="clear-certification"
                  tabIndex={0}
                  onClick={() => updateCertificationData()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateCertificationData();
                    }
                  }}>
                  {t('label.clear')}
                </Typography.Text>
              </Space>
            }>
            <Spin
              indicator={<Loader size="small" />}
              spinning={isLoadingCertificationData}>
              {certificationCardData}
              <div className="flex justify-end text-lg gap-2 mt-4">
                <Button
                  data-testid="close-certification"
                  type="default"
                  onClick={handleCloseCertification}>
                  <CloseOutlined />
                </Button>
                <Button
                  data-testid="update-certification"
                  type="primary"
                  onClick={() =>
                    updateCertificationData(selectedCertification)
                  }>
                  <CheckOutlined />
                </Button>
              </div>
            </Spin>
          </Card>
        </FocusTrapWithContainer>
      }
      overlayClassName="certification-card-popover p-0"
      placement="bottomRight"
      ref={popoverRef}
      showArrow={false}
      trigger="click"
      onOpenChange={onOpenChange}
      {...popoverProps}>
      {children}
    </Popover>
  );
};

export default Certification;
