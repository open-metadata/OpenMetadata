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

import { ModifiedDestination } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';

export const ALERT_AI_DEFAULT_CONNECTION_TIMEOUT = 10;
export const ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH = 1;
export const ALERT_AI_DESCRIPTION_TEXT_AREA_ROWS = 5;
export const ALERT_AI_DESTINATION_TEXT_AREA_ROWS = 2;
export const ALERT_AI_OAUTH_TOKEN_URL_PLACEHOLDER =
  'https://auth.example.com/oauth/token';
export const ALERT_AI_FORM_MODAL_ID = 'alert-form-modal';
export const SEARCHABLE_ARGUMENTS = new Set([
  'domainList',
  'entityIdList',
  'entityNameList',
  'fqnList',
  'ownerNameList',
  'tableNameList',
  'testSuiteList',
  'updateByUserList',
  'userList',
]);

export const EMPTY_ALERT_AI_DESTINATION = {} as ModifiedDestination;

export const ALERT_AI_FORM_CLASS_NAMES = {
  actionButton: 'tw:h-9 tw:w-fit tw:min-w-[112px]',
  advancedConfigHeader: 'tw:flex tw:items-center tw:gap-2',
  alertDescriptionCard:
    'tw:min-h-[137px] tw:rounded-xl tw:border tw:border-secondary tw:p-[18px]',
  autocompleteField:
    'tw:[&_[role=group]>div>span]:min-w-0 tw:[&_[role=group]>div>span]:max-w-full',
  card: 'tw:rounded-lg tw:bg-secondary tw:px-4 tw:py-3',
  columnSpanFull: 'tw:col-span-2',
  customTemplateBodyEditor: 'tw:min-h-[180px]',
  customTemplateBodyTextArea: 'tw:min-h-[140px]',
  customTemplateEditorFrame:
    'tw:overflow-hidden tw:rounded-lg tw:bg-primary tw:outline-1 tw:-outline-offset-1 tw:outline-primary',
  customTemplateFields: 'tw:flex tw:flex-col tw:gap-3',
  customTemplateInfoBanner:
    'tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3',
  customTemplateFieldError: 'tw:mt-1 tw:text-sm tw:text-error-primary',
  customTemplateSubjectFooter: 'tw:mt-1 tw:text-sm tw:text-gray-500',
  descriptionTextArea: 'tw:min-h-[140px]',
  destinationAlert: 'tw:px-4',
  destinationCard:
    'tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-4 tw:py-3',
  downstreamDepthField: 'tw:w-1/2 tw:pr-1.5',
  field: 'tw:min-w-0',
  fieldFill: 'tw:flex-1',
  formStack: 'tw:gap-5',
  removeButton:
    'tw:h-9 tw:w-9 tw:min-w-[36px] tw:shrink-0 tw:p-0 tw:hover:text-error-600 tw:hover:*:data-icon:text-error-600 tw:focus:text-error-600 tw:focus:*:data-icon:text-error-600',
  ruleArgumentsField: 'tw:mr-12 tw:w-auto',
  ruleControlField: 'tw:w-full tw:max-w-[463px]',
  ruleControlGroup: 'tw:w-full tw:max-w-[536px]',
  ruleControlGroupFull: 'tw:w-full',
  ruleControlRow: 'tw:w-full tw:items-end',
  sectionCard: 'tw:rounded-lg tw:bg-secondary tw:px-4 tw:py-3',
  sectionHeader: 'tw:gap-0.5',
  sectionRequiredMarker: 'tw:ml-0.5 tw:text-error-primary',
  sectionRoot: 'tw:gap-1.5',
  teamUserHint: 'tw:mt-1 tw:text-sm tw:text-fg-error-secondary',
  teamUserSelectDropdown:
    'tw:absolute tw:z-50 tw:mt-1 tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-2 tw:shadow-lg',
  teamUserSelectEmptyText: 'tw:p-2 tw:text-center tw:text-tertiary',
  teamUserSelectOptionButton:
    'tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-start tw:gap-2 tw:rounded-md tw:px-2 tw:py-1.5 tw:text-left tw:hover:bg-secondary',
  teamUserSelectOptionLabel: 'tw:truncate tw:text-primary',
  teamUserSelectOptions: 'tw:mt-2 tw:max-h-48 tw:overflow-y-auto',
  teamUserSelectRoot: 'tw:relative tw:w-full',
  teamUserSelectSkeletonWrapper: 'tw:space-y-1 tw:p-2',
  teamUserSelectTrigger:
    'tw:flex tw:min-h-9 tw:w-full tw:cursor-pointer tw:flex-wrap tw:items-center tw:gap-1.5 ' +
    'tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs ' +
    'tw:outline-1 tw:-outline-offset-1 tw:outline-primary',
  teamUserSelectTriggerDisabled: 'tw:cursor-not-allowed tw:opacity-50',
  twoColumnGrid: 'tw:grid tw:grid-cols-2 tw:gap-3',
} as const;
