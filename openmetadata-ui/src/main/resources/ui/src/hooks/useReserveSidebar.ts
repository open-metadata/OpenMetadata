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
import { useEffect, useState } from 'react';

type ReserverSidebar = { isSidebarReserve: boolean };

/**
 * @description Hook to get the if the sidebar should have some reserved space in case of floating button
 * @returns {isSidebarReserve: boolean} - boolean value to check if the sidebar should have some reserved space
 */
export const useReserveSidebar = (): ReserverSidebar => {
  const [isSidebarReserve, setIsSidebarReserve] = useState<boolean>(false);

  useEffect(() => {
    const element = document.querySelector('.floating-button-container');
    setIsSidebarReserve(Boolean(element));
  }, []);

  return {
    isSidebarReserve,
  };
};
