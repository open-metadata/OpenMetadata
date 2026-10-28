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

import { DomainTag, EntityTagProps } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useDomainStyle } from '../../../hooks/useDomainStyle';

export interface StyledDomainTagProps
  extends Omit<EntityTagProps, 'color' | 'icon'> {
  /** The domain whose custom colour and icon the chip takes. */
  fqn?: string;
}

/**
 * A DomainTag in the domain's own colour and icon. The references callers hold
 * carry no `style`, so it is looked up by FQN; until it lands, or for a domain
 * with none, the chip keeps the default colour and globe.
 */
const StyledDomainTag: FC<StyledDomainTagProps> = ({ fqn, ...tagProps }) => {
  const style = useDomainStyle(fqn);

  return <DomainTag {...tagProps} color={style?.color} icon={style?.iconURL} />;
};

export default StyledDomainTag;
