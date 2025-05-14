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
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { Container } from '../../../generated/entity/data/container';
import { useFqn } from '../../../hooks/useFqn';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import ContainerChildren from '../ContainerChildren/ContainerChildren';
import ContainerDataModel from '../ContainerDataModel/ContainerDataModel';

export const ContainerWidget = () => {
  const {
    data: containerData,
    permissions,
    onUpdate,
  } = useGenericContext<Container>();
  const { fqn: decodedContainerName } = useFqn();

  const {
    editDescriptionPermission,
    editGlossaryTermsPermission,
    editTagsPermission,
    deleted,
  } = useMemo(() => {
    const isDeleted = containerData?.deleted;

    return {
      editDescriptionPermission:
        (permissions.EditAll || permissions.EditDescription) && !isDeleted,
      editGlossaryTermsPermission:
        (permissions.EditAll || permissions.EditGlossaryTerms) && !isDeleted,
      editTagsPermission:
        (permissions.EditAll || permissions.EditTags) && !isDeleted,
      deleted: isDeleted,
    };
  }, [permissions, containerData]);

  const isDataModelEmpty = useMemo(
    () => isEmpty(containerData?.dataModel),
    [containerData]
  );

  const handleUpdateDataModel = async (
    updatedDataModel: Container['dataModel']
  ) => {
    await onUpdate({
      ...containerData,
      dataModel: updatedDataModel,
    });
  };

  if (isDataModelEmpty) {
    return <ContainerChildren />;
  }

  return (
    <ContainerDataModel
      dataModel={containerData?.dataModel}
      entityFqn={decodedContainerName}
      hasDescriptionEditAccess={editDescriptionPermission}
      hasGlossaryTermEditAccess={editGlossaryTermsPermission}
      hasTagEditAccess={editTagsPermission}
      isReadOnly={Boolean(deleted)}
      onUpdate={handleUpdateDataModel}
    />
  );
};
