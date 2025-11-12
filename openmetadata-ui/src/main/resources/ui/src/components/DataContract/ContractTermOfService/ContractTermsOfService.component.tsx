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
import Icon from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { useFqn } from '../../../hooks/useFqn';
import BlockEditor from '../../BlockEditor/BlockEditor';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';

export const ContractTermsOfService: React.FC<{
  initialValues?: DataContract;
  onNext: () => void;
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ initialValues, onNext, onChange, onPrev, buttonProps }) => {
  const { fqn } = useFqn();
  const { t } = useTranslation();

  const handleContentOnChange = (value: string) => {
    onChange({ termsOfUse: value });
  };

  return (
    <>
      <Card className="container bg-grey p-box">
        <div className="m-b-sm">
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.terms-of-service')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-terms-of-service-description')}
          </Typography.Paragraph>
        </div>

        <div className="contract-form-content-container">
          <div className="p-l-xl">
            <EntityAttachmentProvider
              allowFileUpload
              entityFqn={fqn}
              entityType={EntityType.TABLE}>
              <BlockEditor
                editable
                content={
                  initialValues?.termsOfUse === '<p></p>'
                    ? undefined
                    : initialValues?.termsOfUse
                }
                showInlineAlert={false}
                onChange={handleContentOnChange}
              />
            </EntityAttachmentProvider>
          </div>
        </div>
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          type="default"
          onClick={onPrev}>
          {buttonProps.prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {buttonProps.nextLabel ?? t('label.next')}
          <Icon component={RightIcon} />
        </Button>
      </div>
    </>
  );
};

export default ContractTermsOfService;
