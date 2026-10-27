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

// The requests the product tour leaves to the server: the signed-in user, their
// permissions and the app's setup. A copy of `TOUR_PASS_THROUGH_PATHS` in
// src/constants/product-tour/productTour.constants.ts, which specs may not
// import; keep the two in step.
export const PRODUCT_TOUR_PASS_THROUGH_PATHS = [
  /^\/auth\//,
  /^\/saml\//,
  /^\/users\/(login|logout|refresh)\b/,
  /^\/users\/loggedInUser/,
  /^\/users\/name\/[^/]+\/?$/,
  /^\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/,
  /^\/permissions/,
  /^\/system\//,
  /^\/apps\/installed/,
  /^\/feed\/count/,
  /^\/docStore/,
  /^\/limits/,
  /^\/analytics\/web/,
];
