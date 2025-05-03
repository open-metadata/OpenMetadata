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
import React, { useCallback, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useHistory, useParams } from 'react-router';
import { SUPPORTED_BULK_IMPORT_EDIT_ENTITY } from '../../constants/BulkImport.constant';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { useFqn } from '../../hooks/useFqn';
import BulkEntityImportPage from '../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';

const EntityImportRouter = () => {
  const history = useHistory();
  const { fqn } = useFqn();
  const { entityType } = useParams<{ entityType: ResourceEntity }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [entityPermission, setEntityPermission] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const entityPermission = await getEntityPermissionByFqn(entityType, fqn);
      setEntityPermission(entityPermission);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, fqn]);

  useEffect(() => {
    if (fqn && SUPPORTED_BULK_IMPORT_EDIT_ENTITY.includes(entityType)) {
      fetchResourcePermission();
    } else {
      history.push(ROUTES.NOT_FOUND);
    }
  }, [fqn, entityType]);

  if (isLoading) {
    return null;
  }

  return (
    <Switch>
      {entityPermission.EditAll && (
        <Route
          exact
          component={BulkEntityImportPage}
          path={[ROUTES.ENTITY_IMPORT, ROUTES.BULK_EDIT_ENTITY_WITH_FQN]}
        />
      )}
      <Redirect to={ROUTES.NOT_FOUND} />
    </Switch>
  );
};

export default EntityImportRouter;
