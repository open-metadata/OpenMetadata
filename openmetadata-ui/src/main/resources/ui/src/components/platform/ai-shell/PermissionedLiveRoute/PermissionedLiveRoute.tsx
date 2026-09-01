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

import { PropsWithChildren } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { userPermissions } from '../../../../utils/PermissionsUtils';
import AdminProtectedRoute from '../../../AppRouter/AdminProtectedRoute';
import { LiveRefreshBoundary } from '../LiveRefreshBoundary/LiveRefreshBoundary';

interface PermissionedLiveRouteProps extends PropsWithChildren {
  /** The OSS resource whose view permission gates the page. */
  resource: ResourceEntity;
}

/**
 * Route element for an embedded app-mode list page (Glossary, Tags, Domains, …) that must
 * (a) honour the SAME view-permission gate its default router applies — so a user without permission
 * keeps seeing the permission placeholder, exactly as in classic mode — and (b) live-refresh
 * on a websocket signal. {@link AdminProtectedRoute} stays mounted across reloads; only the wrapped
 * page remounts when {@link LiveRefreshBoundary} sees a {@code 'dirty'} change for this route.
 */
export const PermissionedLiveRoute = ({
  resource,
  children,
}: PermissionedLiveRouteProps) => {
  const { permissions } = usePermissionProvider();
  const hasPermission = userPermissions.hasViewPermissions(
    resource,
    permissions
  );

  return (
    <AdminProtectedRoute hasPermission={hasPermission}>
      <LiveRefreshBoundary>{children}</LiveRefreshBoundary>
    </AdminProtectedRoute>
  );
};
