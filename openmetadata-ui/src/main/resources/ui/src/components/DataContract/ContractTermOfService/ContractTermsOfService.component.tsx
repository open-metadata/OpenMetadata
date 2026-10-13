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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  TermsOfUse,
} from '../../../generated/entity/data/dataContract';
import { useFqn } from '../../../hooks/useFqn';
import BlockEditor from '../../BlockEditor/BlockEditor';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';

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

  // Extract content from termsOfUse object
  const termsOfUseContent = useMemo(() => {
    const termsOfUse = initialValues?.termsOfUse;
    if (!termsOfUse) {
      return undefined;
    }
    const content = termsOfUse.content;

    return !content || content === '<p></p>' ? undefined : content;
  }, [initialValues?.termsOfUse]);

  const handleContentOnChange = (value: string) => {
    const termsOfUse: TermsOfUse = { content: value };
    onChange({ termsOfUse });
  };

  return (
    <ContractFormStep
      description={t('message.data-contract-terms-of-service-description')}
      isNextVisible={buttonProps.isNextVisible}
      nextLabel={buttonProps.nextLabel}
      prevLabel={buttonProps.prevLabel}
      title={t('label.terms-of-service')}
      onNext={onNext}
      onPrev={onPrev}>
      <div className="contract-form-content-container">
        <div className="p-l-xl">
          <EntityAttachmentProvider
            allowFileUpload
            entityFqn={fqn}
            entityType={EntityType.TABLE}>
            <BlockEditor
              editable
              content={termsOfUseContent}
              showInlineAlert={false}
              onChange={handleContentOnChange}
            />
          </EntityAttachmentProvider>
        </div>
      </div>
    </ContractFormStep>
  );
};

export default ContractTermsOfService;
