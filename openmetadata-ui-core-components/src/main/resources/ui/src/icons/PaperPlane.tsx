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

export const PaperPlane: FC<Props> = ({
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
      d="M4.879 9.998h12.555m-12.675.273-2.47 5.611c-.217.495-.326.742-.278.894a.42.42 0 0 0 .276.276c.152.048.399-.06.893-.278l14.037-6.156c.447-.196.67-.294.739-.43a.42.42 0 0 0 0-.379c-.069-.136-.292-.234-.739-.43L3.18 3.222c-.494-.217-.741-.325-.893-.277a.42.42 0 0 0-.276.276c-.048.152.061.399.279.893l2.469 5.612c.044.1.066.15.075.202a.4.4 0 0 1 0 .14c-.009.052-.031.102-.075.203"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PaperPlane.displayName = 'PaperPlane';
