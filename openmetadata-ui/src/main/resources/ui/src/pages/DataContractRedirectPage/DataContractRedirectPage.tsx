/*
 *  Copyright 2026 Collate.
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

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { ROUTES } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { useFqn } from '../../hooks/useFqn';
import { getContract } from '../../rest/contractAPI';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { getContractAssetFqn } from './DataContractRedirectPage.utils';

/**
 * A data contract has no page of its own: it lives on its asset's Contract
 * tab. Task, notification and activity links address the contract itself, so
 * resolve its asset and send the user there.
 */
const DataContractRedirectPage = () => {
  const { fqn } = useFqn();
  const [path, setPath] = useState<string>();

  useEffect(() => {
    getContract(fqn)
      .then(({ entity, name }) => {
        const assetFqn = getContractAssetFqn(
          fqn,
          name,
          entity.fullyQualifiedName
        );
        setPath(
          assetFqn
            ? getEntityDetailsPath(
                entity.type as EntityType,
                assetFqn,
                EntityTabs.CONTRACT
              )
            : ROUTES.NOT_FOUND
        );
      })
      .catch(() => setPath(ROUTES.NOT_FOUND));
  }, [fqn]);

  return path ? <Navigate replace to={path} /> : <Loader fullScreen />;
};

export default DataContractRedirectPage;
