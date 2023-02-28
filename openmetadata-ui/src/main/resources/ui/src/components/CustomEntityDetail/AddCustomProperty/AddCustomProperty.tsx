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

import { AxiosError } from 'axios';
import { t } from 'i18next';
import { uniqueId } from 'lodash';
import { FormErrorData } from 'Models';
import React, { useEffect, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  addPropertyToEntity,
  getTypeByFQN,
  getTypeListByCategory,
} from 'rest/metadataTypeAPI';
import { SUPPORTED_FIELD_TYPES } from '../../../constants/constants';
import { PageLayoutType } from '../../../enums/layout.enum';
import { Category, Type } from '../../../generated/entity/type';
import { errorMsg, requiredField } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Button } from '../../buttons/Button/Button';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../../common/rich-text-editor/RichTextEditor.interface';
import PageContainerV1 from '../../containers/PageContainerV1';
import PageLayout from '../../containers/PageLayout';
import { Field } from '../../Field/Field';
import { RightPanel } from './RightPanel';

const InitialFormData = {
  name: '',
  type: '',
};

const AddCustomProperty = () => {
  const { entityTypeFQN } = useParams<{ [key: string]: string }>();
  const history = useHistory();
  const markdownRef = useRef<EditorContentRef>();

  const [typeDetail, setTypeDetail] = useState<Type>({} as Type);

  const [propertyTypes, setPropertyTypes] = useState<Array<Type>>([]);

  const [formData, setFormData] =
    useState<Record<string, string>>(InitialFormData);

  const [formErrorData, setFormErrorData] = useState<FormErrorData>(
    {} as FormErrorData
  );

  const getDescription = () => markdownRef.current?.getEditorContent() || '';

  const fetchPropertyType = () => {
    getTypeListByCategory(Category.Field)
      .then((res) => {
        setPropertyTypes(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const fetchTypeDetail = (typeFQN: string) => {
    getTypeByFQN(typeFQN)
      .then((res) => {
        setTypeDetail(res);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const validateName = (name: string) => {
    const nameRegEx = /^[a-z][a-zA-Z0-9]+$/;

    return nameRegEx.test(name);
  };

  const validateType = (type: string) => {
    return Boolean(type);
  };

  const handleError = (flag: boolean, property: string) => {
    const message =
      property === 'name'
        ? t('message.invalid-property-name')
        : t('message.field-text-is-required', { fieldText: t('label.type') });

    setFormErrorData((preVdata) => ({
      ...preVdata,
      [property]: !flag ? message : '',
    }));
  };

  const onChangeHandler = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    switch (name) {
      case 'name': {
        const newData = { ...formData, name: value };
        const isValidName = validateName(value);
        handleError(isValidName, 'name');
        setFormData(newData);

        break;
      }
      case 'type': {
        const newData = { ...formData, type: value };
        const isValidType = validateType(value);
        handleError(isValidType, 'type');
        setFormData(newData);

        break;
      }

      default:
        break;
    }
  };

  const onCancel = () => {
    history.goBack();
  };

  const onSave = () => {
    const isValidName = validateName(formData.name);
    const isValidType = validateType(formData.type);
    if (isValidName && isValidType) {
      const propertyData = {
        description: getDescription(),
        name: formData.name,
        propertyType: {
          id: formData.type,
          type: 'type',
        },
      };
      addPropertyToEntity(typeDetail.id as string, propertyData)
        .then(() => {
          history.goBack();
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    } else {
      handleError(isValidName, 'name');
      handleError(isValidType, 'type');
    }
  };

  const getPropertyTypes = () =>
    propertyTypes.filter((property) =>
      SUPPORTED_FIELD_TYPES.includes(property.name)
    );

  useEffect(() => {
    fetchTypeDetail(entityTypeFQN);
  }, [entityTypeFQN]);

  useEffect(() => {
    fetchPropertyType();
  }, []);

  return (
    <PageContainerV1>
      <div className="tw-self-center">
        <PageLayout
          classes="tw-max-w-full-hd tw-h-full tw-pt-4"
          layout={PageLayoutType['2ColRTL']}
          pageTitle={t('label.add-entity', {
            entity: t('label.custom-property'),
          })}
          rightPanel={<RightPanel />}>
          <div
            className="tw-bg-white tw-p-4 tw-border tw-border-main tw-rounded tw-form-container"
            data-testid="form-container">
            <h6 className="tw-heading tw-text-base">
              {t('label.add-entity', { entity: t('label.custom-property') })}
            </h6>

            <Field>
              <label className="tw-block tw-form-label" htmlFor="name">
                {requiredField(`${t('label.name')}:`)}
              </label>
              <input
                autoComplete="off"
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="name"
                id="name"
                name="name"
                placeholder={t('label.name')}
                type="text"
                value={formData.name}
                onChange={onChangeHandler}
              />
              {formErrorData?.name && errorMsg(formErrorData.name)}
            </Field>

            <Field>
              <label className="tw-block tw-form-label" htmlFor="type">
                {requiredField(`${t('label.type')}:`)}
              </label>
              <select
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="type"
                id="type"
                name="type"
                placeholder={t('label.type')}
                value={formData.type || ''}
                onChange={onChangeHandler}>
                <option value="">
                  {t('label.select-field', {
                    field: t('label.type-lowercase'),
                  })}
                </option>
                {getPropertyTypes().map((propertyType) => (
                  <option key={uniqueId()} value={propertyType.id}>
                    {propertyType.displayName}
                  </option>
                ))}
              </select>
              {formErrorData?.type && errorMsg(formErrorData.type)}
            </Field>
            <Field>
              <label
                className="tw-block tw-form-label tw-mb-0"
                htmlFor="description">
                {`${t('label.description')}:`}
              </label>
              <RichTextEditor
                data-testid="description"
                initialValue=""
                ref={markdownRef}
              />
            </Field>
            <Field className="tw-flex tw-justify-end">
              <Button
                data-testid="cancel-custom-field"
                size="regular"
                theme="primary"
                variant="text"
                onClick={onCancel}>
                {t('label.back')}
              </Button>

              <Button
                className="tw-px-3 tw-rounded"
                data-testid="create-custom-field"
                size="custom"
                theme="primary"
                type="submit"
                onClick={onSave}>
                {t('label.create')}
              </Button>
            </Field>
          </div>
        </PageLayout>
      </div>
    </PageContainerV1>
  );
};

export default AddCustomProperty;
