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

export const AppDataContractValidation: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M14.8 5.2c-.038-1.243-.176-1.984-.69-2.497C13.407 2 12.274 2 10.01 2H6.805c-2.265 0-3.398 0-4.101.703C2 3.406 2 4.537 2 6.8v6.4c0 2.263 0 3.394.704 4.097C3.407 18 4.54 18 6.805 18h3.204c2.265 0 3.397 0 4.101-.703.514-.513.652-1.254.69-2.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15.007 8.207-4.133 4.133c-.03.03-.045.045-.058.062a.3.3 0 0 0-.029.047c-.01.019-.016.039-.03.079l-.453 1.362c-.098.293-.147.44-.112.537a.3.3 0 0 0 .182.182c.097.035.244-.014.537-.112l1.362-.454c.04-.013.06-.02.079-.03a.3.3 0 0 0 .047-.028c.017-.013.032-.028.062-.058l4.132-4.133.942-.941c.216-.217.325-.325.383-.441a.8.8 0 0 0 0-.705c-.058-.117-.166-.225-.383-.441-.216-.217-.324-.325-.441-.383a.8.8 0 0 0-.705 0c-.116.058-.224.166-.44.383zm1.586 1.587-1.586-1.587M4.4 15.602h.504c.107 0 .161 0 .209-.017a.3.3 0 0 0 .112-.07c.036-.034.06-.083.108-.179l.438-.876c.138-.276.207-.414.3-.459a.3.3 0 0 1 .258 0c.093.045.163.183.3.46l.439.875c.048.096.072.145.108.18a.3.3 0 0 0 .112.07.7.7 0 0 0 .209.016H8M5.201 5.2h6.4m-6.4 3.198h4.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppDataContractValidation.displayName = 'AppDataContractValidation';
