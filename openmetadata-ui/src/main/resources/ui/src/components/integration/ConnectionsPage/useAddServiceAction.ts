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

import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_SERVICES_CATEGORY } from '../../../constants/Services.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { Operation } from '../../../generated/entity/policies/policy';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  canCreateAnyServiceCategory,
  getResourceEntityFromServiceCategory,
} from '../../../utils/ServicePureUtils';
import { ConnectionsCategory } from './useConnectionsData';

interface AddServiceAction {
  /** Navigates to the add-service wizard for this category. */
  addService: () => void;
  /** Whether the current user may create a service in this category. */
  canAddService: boolean;
}

/**
 * The add-service action for one connections tab: where it goes and whether the user may take it.
 *
 * Shared by the page header and the empty-state placeholder so the two cannot disagree — the button
 * must always land on the add-service page of the category it was clicked from, and must be absent
 * when the user cannot create that kind of service.
 */
export const useAddServiceAction = (
  category: ConnectionsCategory
): AddServiceAction => {
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();

  // "All Connections" spans every category, so the wizard opens on the `all` sentinel: every
  // category's connectors in one grid, none pre-selected. Picking one continues in that
  // connector's own category.
  const isAllCategories = category === 'all';
  const serviceCategory = isAllCategories ? ALL_SERVICES_CATEGORY : category;

  const canAddService = useMemo(
    () =>
      Boolean(
        !isEmpty(permissions) &&
          // On "All Connections" the button is about creating *something*, so being able to create
          // any one category is enough — checking a single hardcoded category would hide it from a
          // user who can only create, say, API services.
          (isAllCategories
            ? canCreateAnyServiceCategory(permissions)
            : checkPermission(
                Operation.Create,
                getResourceEntityFromServiceCategory(category),
                permissions
              ))
      ),
    [permissions, isAllCategories, category]
  );

  const addService = useCallback(() => {
    navigate(connectionsRouterClassBase.getAddServicePath(serviceCategory));
  }, [navigate, serviceCategory]);

  return { addService, canAddService };
};
