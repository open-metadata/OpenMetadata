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

import { Box } from '@openmetadata/ui-core-components';
import { createContext, FC, ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * The element ApplicationsPanel pins to the bottom of the modal. Views render
 * their actions into it so the buttons sit in the modal footer — like the other
 * profile form pages — while the form state stays inside the view.
 */
export const AppFooterSlotContext = createContext<HTMLElement | null>(null);

export const AppFooter: FC<{ children: ReactNode; testId: string }> = ({
  children,
  testId,
}) => {
  const slot = useContext(AppFooterSlotContext);
  const content = (
    <Box data-testid={testId} direction="row" gap={3} justify="end">
      {children}
    </Box>
  );

  return slot ? createPortal(content, slot) : content;
};
