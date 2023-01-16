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

import { Input, Space, Switch, Typography } from 'antd';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '../../Field/Field';

interface Props {
  dbtClassificationName: string | undefined;
  descriptionId: string;
  handleUpdateDBTClassification: (value: string) => void;
  dbtUpdateDescriptions: boolean;
  handleUpdateDescriptions: (value: boolean) => void;
}

function DBTCommonFields({
  descriptionId,
  dbtUpdateDescriptions,
  dbtClassificationName,
  handleUpdateDescriptions,
  handleUpdateDBTClassification,
}: Props) {
  const { t } = useTranslation();

  return (
    <Fragment>
      <Field>
        <Space align="end" className="m-b-xs">
          <label
            className="tw-form-label m-b-0 tw-mb-1"
            data-testid={descriptionId}
            htmlFor={descriptionId}>
            {t('label.update-description')}
          </label>
          <Switch
            checked={dbtUpdateDescriptions}
            data-testid="description-switch"
            id={descriptionId}
            onChange={handleUpdateDescriptions}
          />
        </Space>
        <Typography.Text
          className="d-block text-grey-muted m-b-xs text-xs"
          data-testid="switch-description">
          {t('message.optional-configuration-update-description-dbt')}
        </Typography.Text>
      </Field>

      <Field>
        <label
          className="tw-form-label tw-mb-1"
          data-testid="dbt-classification-label"
          htmlFor="dbt-object-prefix">
          {t('label.dbt-classification-name')}
        </label>

        <Typography.Text
          className="d-block text-grey-muted m-b-xs text-xs"
          data-testid="dbt-classification-description">
          {t('message.custom-classification-name-dbt-tags')}
        </Typography.Text>

        <Input
          className="tw-form-inputs"
          data-testid="dbt-classification-name"
          id="dbt-classification-name"
          name="dbt-classification-name"
          value={dbtClassificationName}
          onChange={(e) => handleUpdateDBTClassification(e.target.value)}
        />
      </Field>
    </Fragment>
  );
}

export default DBTCommonFields;
