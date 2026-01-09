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

import React from 'react';

export const UniqueColumnsIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
    fill="none"
    height="39"
    viewBox="0 0 39 39"
    width="39"
    xmlns="http://www.w3.org/2000/svg">
    <rect fill="#F6F6FD" height="39" rx="6" width="39" />
    <rect fill="#D0D9EF" height="21" rx="4" width="21" x="9" y="9" />
    <path
      d="M19.4922 17.5752L21.2598 15H24.7402V23.6885H21.2598L19.4922 21.3066L17.7246 23.6885H14.2441V15H17.7246L19.4922 17.5752Z"
      fill="white"
    />
    <path
      d="M24.049 23.6817H14.9507"
      stroke="#3455A7"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M24.049 19.4952H14.9507"
      stroke="#3455A7"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M24.0493 15.3184H14.9507"
      stroke="#3455A7"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

export const OccurrencesIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
    fill="none"
    height="39"
    viewBox="0 0 39 39"
    width="39"
    xmlns="http://www.w3.org/2000/svg">
    <rect fill="#E4FBF2" height="39" rx="6" width="39" />
    <rect fill="#A7EBD0" height="19" rx="3" width="31" x="4" y="10" />
    <path
      d="M12.9287 19.0859L13.812 20.2857L16.0716 17.9286"
      stroke="#137C50"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <rect
      height="7.85714"
      rx="3.92857"
      stroke="#137C50"
      strokeWidth="1.2"
      width="17.2857"
      x="9"
      y="15.5714"
    />
    <circle
      cx="23.9287"
      cy="19.5"
      fill="white"
      r="5.5"
      stroke="#137C50"
      strokeWidth="1.2"
    />
  </svg>
);

export const PendingChangesIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
    fill="none"
    height="39"
    viewBox="0 0 39 39"
    width="39"
    xmlns="http://www.w3.org/2000/svg">
    <rect fill="#FDF7E9" height="39" rx="6" width="39" />
    <rect fill="#FDE8B7" height="24" rx="12" width="24" x="7.5" y="7.5" />
    <circle
      cx="19.5"
      cy="19.5"
      fill="white"
      r="7"
      stroke="#B89334"
      strokeWidth="1.5"
    />
    <path
      d="M18.8381 17.2108V20.5442L21.2995 21.7891"
      stroke="#B89334"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

export const TagIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    height="12"
    viewBox="0 0 12 12"
    width="12"
    xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.5 6.5L6.5 10.5L1.5 5.5V1.5H5.5L10.5 6.5Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <circle cx="3.5" cy="3.5" fill="currentColor" r="1" />
  </svg>
);
