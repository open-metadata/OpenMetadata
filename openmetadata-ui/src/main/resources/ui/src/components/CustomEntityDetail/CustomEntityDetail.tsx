/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getTypeByFQN, updateType } from '../../axiosAPIs/metadataTypeAPI';
import { getAddCustomFieldPath } from '../../constants/constants';
import { Type } from '../../generated/entity/type';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import PageLayout from '../containers/PageLayout';
import SchemaEditor from '../schema-editor/SchemaEditor';
import { CustomFieldTable } from './CustomFieldTable';
import { LeftPanel } from './LeftPanel';

interface Props {
  entityTypes: Array<Type>;
  entityTypeFQN?: string;
}

const CustomEntityDetail: FC<Props> = ({ entityTypes, entityTypeFQN }) => {
  const history = useHistory();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedEntityType, setSelectedEntityType] = useState<Type>(
    {} as Type
  );
  const [selectedEntityTypeDetail, setSelectedEntityTypeDetail] =
    useState<Type>({} as Type);

  const fetchTypeDetail = (typeFQN: string) => {
    getTypeByFQN(typeFQN)
      .then((res: AxiosResponse) => {
        setSelectedEntityTypeDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onTabChange = (tab: number) => {
    setActiveTab(tab);
  };

  const onEntityTypeSelect = (entityType: Type) => {
    setSelectedEntityType(entityType);
  };

  const handleAddField = () => {
    const path = getAddCustomFieldPath(
      selectedEntityTypeDetail.fullyQualifiedName as string
    );
    history.push(path);
  };

  const schemaCheck = activeTab === 1 && !isEmpty(selectedEntityTypeDetail);
  const schemaValue = selectedEntityTypeDetail.schema || '{}';

  const customFieldsCheck =
    activeTab === 2 && !isEmpty(selectedEntityTypeDetail);
  const customFields = selectedEntityTypeDetail.customFields || [];

  const tabs = [
    {
      name: 'Schema',
      isProtected: false,
      position: 1,
    },
    {
      name: 'Custom Fields',
      isProtected: false,
      position: 2,
      count: customFields.length,
    },
  ];

  const componentCheck = Boolean(entityTypes.length);

  const updateEntityType = (fields: Type['customFields']) => {
    const patch = compare(selectedEntityTypeDetail, {
      ...selectedEntityTypeDetail,
      customFields: fields,
    });

    updateType(selectedEntityTypeDetail.id as string, patch)
      .then((res: AxiosResponse) => {
        const { customFields: Fields } = res.data;

        setSelectedEntityTypeDetail((prev) => ({
          ...prev,
          customFields: Fields,
        }));
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  useEffect(() => {
    if (entityTypes.length) {
      const entityType =
        entityTypes.find((type) => type.fullyQualifiedName === entityTypeFQN) ||
        entityTypes[0];
      onEntityTypeSelect(entityType);
    }
  }, [entityTypes, entityTypeFQN]);

  useEffect(() => {
    if (!isEmpty(selectedEntityType)) {
      fetchTypeDetail(selectedEntityType.fullyQualifiedName as string);
    }
  }, [selectedEntityType]);

  return (
    <PageContainer>
      {componentCheck ? (
        <PageLayout
          leftPanel={
            <LeftPanel
              selectedType={selectedEntityTypeDetail}
              typeList={entityTypes}
            />
          }>
          <TabsPane
            activeTab={activeTab}
            setActiveTab={onTabChange}
            tabs={tabs}
          />
          <div className="tw-mt-6">
            {schemaCheck && (
              <div data-testid="entity-schema">
                <SchemaEditor
                  className="tw-border tw-border-main tw-rounded-md tw-py-4"
                  editorClass="custom-entity-schema"
                  value={JSON.parse(schemaValue)}
                />
              </div>
            )}
            {customFieldsCheck && (
              <div data-testid="entity-custom-fields">
                <div className="tw-flex tw-justify-end">
                  <Button
                    className="tw-mb-4 tw-py-1 tw-px-2 tw-rounded"
                    data-testid="add-field-button"
                    size="custom"
                    theme="primary"
                    onClick={() => handleAddField()}>
                    Add Field
                  </Button>
                </div>
                <CustomFieldTable
                  customFields={customFields}
                  updateEntityType={updateEntityType}
                />
              </div>
            )}
          </div>
        </PageLayout>
      ) : (
        <ErrorPlaceHolder>
          {jsonData['message']['no-custom-entity']}
        </ErrorPlaceHolder>
      )}
    </PageContainer>
  );
};

export default CustomEntityDetail;
