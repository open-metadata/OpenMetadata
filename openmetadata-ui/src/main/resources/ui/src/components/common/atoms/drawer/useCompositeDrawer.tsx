/*
 *  Copyright 2024 Collate.
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

import { Box } from '@mui/material';
import { useMemo } from 'react';
import { DrawerConfig, useDrawer } from './useDrawer';
import { DrawerBodyConfig, useDrawerBody } from './useDrawerBody';
import { DrawerFooterConfig, useDrawerFooter } from './useDrawerFooter';
import { DrawerHeaderConfig, useDrawerHeader } from './useDrawerHeader';

export interface CompositeDrawerConfig extends DrawerConfig {
  header?: DrawerHeaderConfig;
  body?: DrawerBodyConfig;
  footer?: DrawerFooterConfig;
}

/**
 * Composite drawer hook that combines all drawer atoms
 *
 * @description
 * Higher-level hook that composes drawer atoms into a complete drawer.
 * Provides a fully configured drawer with header, body, and footer.
 *
 * @param config - Combined configuration for all drawer parts
 *
 * @example
 * ```typescript
 * const drawer = useCompositeDrawer({
 *   anchor: 'right',
 *   width: 600,
 *   header: {
 *     title: 'Edit User',
 *     onClose: handleClose
 *   },
 *   body: {
 *     children: <UserForm />,
 *     loading: isLoading
 *   },
 *   footer: {
 *     primaryButton: {
 *       label: 'Save',
 *       onClick: handleSave
 *     },
 *     secondaryButton: {
 *       label: 'Cancel',
 *       onClick: handleClose
 *     }
 *   }
 * });
 *
 * return (
 *   <>
 *     <Button onClick={drawer.openDrawer}>Open</Button>
 *     {drawer.compositeDrawer}
 *   </>
 * );
 * ```
 */
export const useCompositeDrawer = (config: CompositeDrawerConfig = {}) => {
  const { header = {}, body = {}, footer = {}, ...drawerConfig } = config;

  const baseDrawer = useDrawer(drawerConfig);
  const { drawerHeader } = useDrawerHeader({
    ...header,
    onClose: header.onClose || baseDrawer.closeDrawer,
  });
  const { drawerBody } = useDrawerBody(body);
  const { drawerFooter } = useDrawerFooter(footer);

  const drawerContent = useMemo(
    () => (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {drawerHeader}
        {drawerBody}
        {drawerFooter}
      </Box>
    ),
    [drawerHeader, drawerBody, drawerFooter]
  );

  const compositeDrawer = useMemo(() => {
    const DrawerComponent = baseDrawer.drawer as any;
    const Component = DrawerComponent.type;

    return <Component {...DrawerComponent.props} children={drawerContent} />;
  }, [baseDrawer.drawer, drawerContent]);

  return {
    ...baseDrawer,
    compositeDrawer,
    drawerHeader,
    drawerBody,
    drawerFooter,
  };
};

/**
 * Simplified composite drawer with render prop pattern
 *
 * @description
 * Alternative API using render props for more flexibility
 *
 * @example
 * ```typescript
 * const drawer = useCompositeDrawerWithRender({
 *   anchor: 'right',
 *   width: 500,
 *   render: ({ closeDrawer }) => ({
 *     header: {
 *       title: 'Settings',
 *       onClose: closeDrawer
 *     },
 *     body: {
 *       children: <SettingsForm />
 *     },
 *     footer: {
 *       primaryButton: {
 *         label: 'Apply',
 *         onClick: () => {
 *           applySettings();
 *           closeDrawer();
 *         }
 *       }
 *     }
 *   })
 * });
 * ```
 */
export const useCompositeDrawerWithRender = (
  config: Omit<CompositeDrawerConfig, 'header' | 'body' | 'footer'> & {
    render: (actions: {
      openDrawer: () => void;
      closeDrawer: () => void;
      toggleDrawer: () => void;
    }) => {
      header?: DrawerHeaderConfig;
      body?: DrawerBodyConfig;
      footer?: DrawerFooterConfig;
    };
  }
) => {
  const { render, ...drawerConfig } = config;
  const baseDrawer = useDrawer(drawerConfig);

  const { header, body, footer } = render({
    openDrawer: baseDrawer.openDrawer,
    closeDrawer: baseDrawer.closeDrawer,
    toggleDrawer: baseDrawer.toggleDrawer,
  });

  return useCompositeDrawer({
    ...drawerConfig,
    header,
    body,
    footer,
  });
};
