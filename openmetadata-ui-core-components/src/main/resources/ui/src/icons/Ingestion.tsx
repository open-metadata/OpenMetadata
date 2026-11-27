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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Ingestion: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2 13.2v.488a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-.489m-8-4.324V3.313m2.472 3.297S10.65 9.082 10 9.082c-.652 0-2.473-2.472-2.473-2.472m5.795 6.097c.731-1.266 1.375-2.382 1.758-2.867a8.4 8.4 0 0 1 1.94-1.796"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.258 10.553c.138.547.247 2.452.732 2.732s2.19-.578 2.732-.732m-9.044.154c-.731-1.266-1.375-2.382-1.758-2.867a8.4 8.4 0 0 0-1.94-1.796"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.742 10.553c-.138.547-.247 2.452-.732 2.732s-2.19-.578-2.732-.732"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Ingestion.displayName = 'Ingestion';
