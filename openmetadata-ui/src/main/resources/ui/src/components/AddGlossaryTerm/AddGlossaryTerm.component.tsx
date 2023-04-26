/*
 *  Copyright 2022 Collate.
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

import { useForm } from 'antd/lib/form/Form';
import AddGlossaryTermForm from 'components/AddGlossaryTermForm/AddGlossaryTermForm.component';
import { t } from 'i18next';
import React from 'react';
import { PageLayoutType } from '../../enums/layout.enum';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import { AddGlossaryTermProps } from './AddGlossaryTerm.interface';

const AddGlossaryTerm = ({
  glossaryData,
  onCancel,
  slashedBreadcrumb,
  isLoading,
}: AddGlossaryTermProps) => {
  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">
          {t('label.configure-entity', {
            entity: t('label.glossary-term'),
          })}
        </h6>
        <div className="tw-mb-5">
          {t('message.configure-glossary-term-description')}
        </div>
      </>
    );
  };
  const [form] = useForm();

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
      layout={PageLayoutType['2ColRTL']}
      pageTitle={t('label.add-entity', { entity: t('label.glossary-term') })}
      rightPanel={fetchRightPanel()}>
      <div className="tw-form-container" data-testid="add-glossary-term">
        <h6 className="tw-heading tw-text-base">
          {t('label.add-entity', {
            entity: t('label.glossary-term'),
          })}
        </h6>
        <AddGlossaryTermForm
          editMode={false}
          formRef={form}
          glossaryName={glossaryData.name}
          glossaryReviewers={glossaryData.reviewers}
          isLoading={isLoading}
          onCancel={onCancel}
          onSave={(data) => console.debug(data)}
        />
      </div>
    </PageLayout>
  );
};

export default AddGlossaryTerm;
