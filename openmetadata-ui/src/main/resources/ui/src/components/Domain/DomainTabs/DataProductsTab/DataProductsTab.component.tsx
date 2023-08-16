/*
 *  Copyright 2023 Collate.
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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onAddDataProduct: () => void;
  permissions: OperationPermission;
}

const DataProductsTab = ({ permissions, onAddDataProduct }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="m-t-xlg">
      <ErrorPlaceHolder
        doc={GLOSSARIES_DOCS}
        heading={t('label.data-product')}
        permission={permissions.Create}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={onAddDataProduct}
      />
    </div>
  );
};

export default DataProductsTab;
