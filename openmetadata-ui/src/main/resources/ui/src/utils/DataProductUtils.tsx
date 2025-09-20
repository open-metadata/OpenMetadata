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
import { ReactComponent as DefaultDataProductIcon } from '../assets/svg/ic-data-product.svg';

/**
 * Get data product icon based on optional icon URL
 * Matches the DomainUtils pattern for consistency
 * @param iconURL - Optional icon URL
 * @returns JSX element representing the icon
 */
export const getDataProductIconByUrl = (iconURL?: string) => {
  if (iconURL) {
    return (
      <img
        alt="data product icon"
        className="data-product-icon-url"
        src={iconURL}
      />
    );
  }

  return <DefaultDataProductIcon className="data-product-default-icon" />;
};
