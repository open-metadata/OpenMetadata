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

// Base components
export * from "./base/avatar/avatar";
export * from "./base/avatar/avatar-label-group";
export * from "./base/avatar/avatar-profile-photo";
export * from "./base/avatar/base-components";
export * from "./base/avatar/utils";
export * from "./base/badges/badge-groups";
export * from "./base/badges/badge-types";
export * from "./base/badges/badges";
export {
  styles as buttonGroupStyles,
  ButtonGroupItem,
  ButtonGroup,
} from "./base/button-group/button-group";
export * from "./base/buttons/app-store-buttons";
export {
  GooglePlayButton as GooglePlayButtonOutline,
  AppStoreButton as AppStoreButtonOutline,
  GalaxyStoreButton as GalaxyStoreButtonOutline,
  AppGalleryButton as AppGalleryButtonOutline,
} from "./base/buttons/app-store-buttons-outline";
export {
  styles as buttonUtilityStyles,
  type CommonProps as ButtonUtilityCommonProps,
  type ButtonProps as ButtonUtilityProps,
  type Props as ButtonUtilityPropsUnion,
  ButtonUtility,
} from "./base/buttons/button-utility";
export * from "./base/buttons/button";
export * from "./base/buttons/close-button";
export {
  styles as socialButtonStyles,
  type SocialButtonProps,
  SocialButton,
} from "./base/buttons/social-button";
export * from "./base/buttons/social-logos";
export * from "./base/checkbox/checkbox";
export * from "./base/input/input";
export * from "./base/input/hint-text";
export * from "./base/input/input-group";
export * from "./base/input/label";
export * from "./base/dropdown/dropdown";
export * from "./base/file-upload-trigger/file-upload-trigger";
export * from "./base/select/select";
export * from "./base/select/multi-select";
export * from "./base/select/combobox";
export * from "./base/select/popover";
export * from "./base/select/select-item";
export * from "./base/select/select-native";
export * from "./base/form/form";
export * from "./base/form/hook-form";
export * from "./base/progress-indicators/progress-circles";
export * from "./base/progress-indicators/progress-indicators";
export * from "./base/progress-indicators/simple-circle";
export * from "./base/radio-buttons/radio-buttons";
export * from "./base/slider/slider";
export * from "./base/tags/tags";
export * from "./base/tags/base-components/tag-checkbox";
export * from "./base/tags/base-components/tag-close-x";
export * from "./base/textarea/textarea";
export * from "./base/toggle/toggle";
export * from "./base/tooltip/tooltip";
export * from "./base/video-player/icons";
export * from "./base/video-player/play-button-icon";

// Application components
export * from "./application/date-picker/calendar";
export * from "./application/date-picker/cell";
export * from "./application/date-picker/date-input";
export * from "./application/date-picker/date-picker";
export * from "./application/date-picker/date-range-picker";
export * from "./application/date-picker/range-calendar";
export * from "./application/date-picker/range-preset";
export * from "./application/modals/modal";
export * from "./application/pagination/pagination-base";
export * from "./application/pagination/pagination-dot";
export * from "./application/pagination/pagination-line";
export * from "./application/pagination/pagination";
export { SlideoutMenu } from "./application/slideout-menus/slideout-menu";
export * from "./application/table/table";
export * from "./application/tabs/tabs";

// Foundations
export * from "./foundations/dot-icon";
export * from "./foundations/typography";

// Other components
export * from "./checkbox-icons";
export * from "./SnackbarContent";
