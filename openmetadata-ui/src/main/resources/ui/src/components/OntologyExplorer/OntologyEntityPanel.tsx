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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import { lazy, ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { useAlertStore } from '../../hooks/useAlertStore';
import { EntityData } from '../../pages/TasksPage/TasksPage.interface';
import { getGlossaryTermByFQN } from '../../rest/glossaryAPI';
import AlertBar from '../AlertBar/AlertBar';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import { EntityDetailsObjectInterface } from '../Explore/ExplorePage.interface';
import { isValidUUID } from './utils/graphBuilders';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () => import('../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

const PANEL_WIDTH = 576;

interface OntologyEntityPanelProps {
  readonly isOpen: boolean;
  readonly entityDetails: EntityDetailsObjectInterface;
  readonly panelPath: string;
  readonly sideDrawerOverviewOnly?: boolean;
  readonly ontologyRelationsSlot?: ReactNode;
  readonly onClose: () => void;
  readonly afterEntityUpdate?: (updatedData: EntityData) => void;
}

export const OntologyEntityPanel = ({
  isOpen,
  entityDetails,
  panelPath,
  sideDrawerOverviewOnly = false,
  ontologyRelationsSlot,
  onClose,
  afterEntityUpdate,
}: OntologyEntityPanelProps) => {
  const { alert, resetAlert } = useAlertStore();
  const [localToast, setLocalToast] = useState<{
    open: boolean;
    message: string | JSX.Element;
    type: 'success' | 'error';
  }>({ message: '', open: false, type: 'success' });
  const [resolvedDetails, setResolvedDetails] =
    useState<EntityDetailsObjectInterface>(entityDetails);

  // Intercept global alerts when the panel is open so they show inside
  // the slideout instead of on the background page via PageLayoutV1.
  useLayoutEffect(() => {
    if (!alert || !isOpen) {
      return;
    }
    setLocalToast({
      message: alert.message,
      open: true,
      type: alert.type === 'error' ? 'error' : 'success',
    });
    resetAlert();
  }, [alert, isOpen, resetAlert]);

  useEffect(() => {
    if (!localToast.open) {
      return undefined;
    }
    const timer = setTimeout(
      () => setLocalToast((prev) => ({ ...prev, open: false })),
      3000
    );

    return () => clearTimeout(timer);
  }, [localToast]);

  // Data-mode nodes built by buildGraphFromCounts use the FQN as the graph id
  // instead of a real UUID. Fetch the term by FQN to get the actual UUID so
  // PATCH operations in EntitySummaryPanel receive a valid id.
  useEffect(() => {
    const id = entityDetails.details?.id ?? '';
    const fqn = entityDetails.details?.fullyQualifiedName ?? '';

    if (isValidUUID(id) || !fqn) {
      setResolvedDetails(entityDetails);

      return;
    }

    getGlossaryTermByFQN(fqn)
      .then((term) => {
        setResolvedDetails({
          ...entityDetails,
          details: { ...entityDetails.details, id: term.id ?? id },
        });
      })
      .catch(() => setResolvedDetails(entityDetails));
  }, [entityDetails]);

  return (
    <SlideoutMenu
      isDismissable
      className="tw:z-2"
      dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
      isOpen={isOpen}
      width={PANEL_WIDTH}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      {() => (
        <>
          {localToast.open && (
            <div className="tw:mt-2 tw:mx-3">
              <AlertBar
                defaultExpand
                className="show-alert"
                message={localToast.message}
                type={localToast.type}
              />
            </div>
          )}
          <EntitySummaryPanel
            isSideDrawer
            afterEntityUpdate={afterEntityUpdate}
            entityDetails={resolvedDetails}
            handleClosePanel={onClose}
            ontologyExplorerRelationsSlot={ontologyRelationsSlot}
            panelPath={panelPath}
            sideDrawerOverviewOnly={sideDrawerOverviewOnly}
          />
        </>
      )}
    </SlideoutMenu>
  );
};
