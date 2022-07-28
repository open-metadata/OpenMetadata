/*
 *  Copyright 2022 Collate
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
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getTypeByFQN, updateType } from '../../axiosAPIs/metadataTypeAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { CustomPropertyTable } from '../../components/CustomEntityDetail/CustomPropertyTable';
import Loader from '../../components/Loader/Loader';
import SchemaEditor from '../../components/schema-editor/SchemaEditor';
import { getAddCustomPropertyPath } from '../../constants/constants';
import { customAttributesPath } from '../../constants/globalSettings.constants';
import { Type } from '../../generated/entity/type';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const CustomEntityDetailV1 = () => {
  const { tab } = useParams<{ [key: string]: string }>();
  const history = useHistory();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [selectedEntityTypeDetail, setSelectedEntityTypeDetail] =
    useState<Type>({} as Type);

  const fetchTypeDetail = async (typeFQN: string) => {
    setIsLoading(true);
    try {
      const { data } = await getTypeByFQN(typeFQN);
      setSelectedEntityTypeDetail(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError(true);
    }
    setIsLoading(false);
  };

  const onTabChange = (tab: number) => {
    setActiveTab(tab);
  };

  const handleAddProperty = () => {
    const path = getAddCustomPropertyPath(tab);
    history.push(path);
  };

  const tabs = useMemo(() => {
    const { customProperties } = selectedEntityTypeDetail;

    return [
      {
        name: 'Custom Properties',
        isProtected: false,
        position: 1,
        count: (customProperties || []).length,
      },
      {
        name: 'Schema',
        isProtected: false,
        position: 2,
      },
    ];
  }, [selectedEntityTypeDetail]);

  const updateEntityType = async (properties: Type['customProperties']) => {
    const patch = compare(selectedEntityTypeDetail, {
      ...selectedEntityTypeDetail,
      customProperties: properties,
    });

    try {
      const { data } = await updateType(
        selectedEntityTypeDetail.id || '',
        patch
      );
      setSelectedEntityTypeDetail((prev) => ({
        ...prev,
        customProperties: data.customProperties,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (!isUndefined(tab)) {
      setActiveTab(1);
      setIsError(false);
      fetchTypeDetail(
        customAttributesPath[tab as keyof typeof customAttributesPath]
      );
    }
  }, [tab]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {jsonData['message']['no-custom-entity']}
      </ErrorPlaceHolder>
    );
  }

  return (
    <div data-testid="custom-entity-container">
      <TabsPane activeTab={activeTab} setActiveTab={onTabChange} tabs={tabs} />
      <div className="tw-mt-4">
        {activeTab === 2 && (
          <div data-testid="entity-schema">
            <SchemaEditor
              className="tw-border tw-border-main tw-rounded-md tw-py-4"
              editorClass="custom-entity-schema"
              value={JSON.parse(selectedEntityTypeDetail.schema ?? '{}')}
            />
          </div>
        )}
        {activeTab === 1 && (
          <div data-testid="entity-custom-fields">
            <div className="tw-flex tw-justify-end">
              <Button
                className="tw-mb-4 tw-py-1 tw-px-2 tw-rounded"
                data-testid="add-field-button"
                size="custom"
                theme="primary"
                onClick={() => handleAddProperty()}>
                Add Property
              </Button>
            </div>
            <CustomPropertyTable
              customProperties={selectedEntityTypeDetail.customProperties || []}
              updateEntityType={updateEntityType}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomEntityDetailV1;
