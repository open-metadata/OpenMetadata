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
import { ProductTourStep } from '../../../interface/product-tour/productTour.interface';
import i18n, { Transi18next } from '../../../utils/i18next/LocalUtil';

/** A step's copy, with its feature name in bold. */
const ProductTourStepContent = ({ i18nKey, labelKey }: ProductTourStep) => (
  <p>
    <Transi18next
      i18nKey={i18nKey}
      renderElement={<strong />}
      values={{ text: i18n.t(labelKey) }}
    />
  </p>
);

export default ProductTourStepContent;
