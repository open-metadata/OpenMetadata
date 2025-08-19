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

import { createFocusTrap, FocusTrap as FocusTrapInstance } from 'focus-trap';
import { useCallback, useEffect, useRef } from 'react';

type UseMultiContainerFocusTrapProps = {
  containers: Array<HTMLElement | null | undefined>;
  active?: boolean;
  options?: Parameters<typeof createFocusTrap>[1];
};

export function useMultiContainerFocusTrap({
  containers,
  active = true,
  options = {},
}: UseMultiContainerFocusTrapProps) {
  const trapRef = useRef<FocusTrapInstance | null>(null);

  const activateTrap = useCallback(() => {
    const validContainers = containers.filter(Boolean) as HTMLElement[];
    if (validContainers.length === 0) {
      return;
    }
    // If already active, deactivate before re-activating with new containers
    if (trapRef.current) {
      trapRef.current.deactivate();
      trapRef.current = null;
    }
    trapRef.current = createFocusTrap(validContainers, {
      fallbackFocus: validContainers[0],
      clickOutsideDeactivates: true,
      returnFocusOnDeactivate: false,
      escapeDeactivates: false,
      allowOutsideClick: true,
      ...options,
    });
    trapRef.current.activate();
  }, [options, ...containers]);

  const deactivateTrap = useCallback(() => {
    if (trapRef.current) {
      trapRef.current.deactivate();
      trapRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (active) {
      activateTrap();

      return () => {
        deactivateTrap();
      };
    } else {
      deactivateTrap();

      return;
    }
  }, [active, activateTrap, deactivateTrap]);

  return {
    trapRef,
  };
}

export const FocusTrapWithContainer = ({
  children,
  active = true,
  options,
}: {
  children: React.ReactNode;
  active?: boolean;
  options?: Parameters<typeof createFocusTrap>[1];
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useMultiContainerFocusTrap({
    containers: [containerRef.current],
    active,
    options,
  });

  return (
    <div
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}>
      {children}
    </div>
  );
};
