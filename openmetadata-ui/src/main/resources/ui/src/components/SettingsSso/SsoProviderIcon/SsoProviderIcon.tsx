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

import type { ProviderIcon } from '../../../utils/SSOUtils';

interface SsoProviderIconProps {
  icon: ProviderIcon;
  alt?: string;
  size?: number;
}

// Provider logos are a mix of raster/legacy image URLs and core icon components.
const SsoProviderIcon = ({
  icon: Icon,
  alt = '',
  size = 24,
}: SsoProviderIconProps) =>
  typeof Icon === 'function' ? (
    <Icon size={size} />
  ) : (
    <img alt={alt} height={size} src={Icon} width={size} />
  );

export default SsoProviderIcon;
