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

import { useCallback, useMemo } from 'react';
import { DrawerConfig, useDrawer } from './useDrawer';
import { DrawerBodyConfig, useDrawerBody } from './useDrawerBody';
import { DrawerFooterConfig, useDrawerFooter } from './useDrawerFooter';
import { DrawerHeaderConfig, useDrawerHeader } from './useDrawerHeader';

export interface CompositeDrawerConfig extends DrawerConfig {
  header?: DrawerHeaderConfig;
  body?: DrawerBodyConfig;
  footer?: DrawerFooterConfig;
  onBeforeClose?: () => void;
}

export const useCompositeDrawer = (config: CompositeDrawerConfig = {}) => {
  const {
    header = {},
    body = {},
    footer = {},
    onBeforeClose,
    ...drawerConfig
  } = config;

  const baseDrawer = useDrawer(drawerConfig);

  const handleClose = useCallback(() => {
    onBeforeClose?.();
    if (header.onClose) {
      header.onClose();
    } else {
      baseDrawer.closeDrawer();
    }
  }, [onBeforeClose, header.onClose, baseDrawer.closeDrawer]);

  const { drawerHeader } = useDrawerHeader({
    ...header,
    onClose: handleClose,
  });
  const { drawerBody } = useDrawerBody(body);
  const { drawerFooter } = useDrawerFooter(footer);

  const drawerContent = useMemo(
    () => (
      <>
        {drawerHeader}
        {drawerBody}
        {drawerFooter}
      </>
    ),
    [drawerHeader, drawerBody, drawerFooter]
  );

  const compositeDrawer = useMemo(() => {
    const DrawerComponent = baseDrawer.drawer;
    const Component = DrawerComponent.type;

    return <Component {...DrawerComponent.props} children={drawerContent} />;
  }, [baseDrawer.drawer, drawerContent]);

  const closeDrawer = useCallback(() => {
    onBeforeClose?.();
    baseDrawer.closeDrawer();
  }, [onBeforeClose, baseDrawer.closeDrawer]);

  return {
    ...baseDrawer,
    closeDrawer,
    compositeDrawer,
    drawerHeader,
    drawerBody,
    drawerFooter,
  };
};

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
