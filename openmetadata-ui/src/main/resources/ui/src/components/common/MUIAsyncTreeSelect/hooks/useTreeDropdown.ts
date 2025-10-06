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

import { useCallback, useState } from 'react';

export const useTreeDropdown = () => {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const openDropdown = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleDropdown = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const setDropdownAnchor = useCallback((element: HTMLElement | null) => {
    setAnchorEl(element);
  }, []);

  return {
    open,
    anchorEl,
    openDropdown,
    closeDropdown,
    toggleDropdown,
    setDropdownAnchor,
  };
};
