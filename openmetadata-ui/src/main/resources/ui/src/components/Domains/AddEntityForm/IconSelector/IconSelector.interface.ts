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

import { FunctionComponent, SVGProps } from 'react';

export enum IconSelectorTab {
  ICONS = 'icons',
  URL = 'url',
  UPLOAD_IMAGE = 'upload-image',
}

export interface DomainIcon {
  fileName: string;
  displayName: string;
  svg: FunctionComponent<SVGProps<SVGSVGElement>>;
}

export interface IconSelectorProps {
  open: boolean;
  selectedIconFileName?: string;
  selectedIconUrl?: string;
  onIconSelect: (fileName: string) => void;
  onUrlSelect: (url: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export interface IconSelectorState {
  activeTab: IconSelectorTab;
  searchQuery: string;
  iconUrlInput: string;
}
