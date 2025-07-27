/* eslint-disable i18next/no-literal-string */
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
import { useFqn } from '../../../hooks/useFqn';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateDataContract } from '../../../generated/api/data/createDataContract';
import { EntityType } from '../../../generated/api/tests/createTestDefinition';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import AddDataContract from '../AddDataContract/AddDataContract';

export const ContractTab = () => {
  const { fqn } = useFqn();
  const { t } = useTranslation();
  const [tabMode, setTabMode] = useState<'add' | 'edit' | 'view'>('add');

  const contract: CreateDataContract = {
    name: 'test',
    description: 'test',
    entity: {
      type: EntityType.Table,
      fullyQualifiedName: fqn,
      id: '1',
    },
  };

  useEffect(() => {
    if (fqn) {
      setTabMode('view');
    }
  }, [fqn]);

  const content = useMemo(() => {
    switch (tabMode) {
      case 'add':
        return <AddDataContract />;

      case 'edit':
        return <div>Edit</div>;

      case 'view':
        return <div>{fqn}</div>;
    }
  }, [tabMode, fqn]);

  if (isEmpty(contract)) {
    return <ErrorPlaceHolderNew heading={t('label.no-contracts')} />;
  }

  return content;
};
