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
// This entry is bundled into a browser script, never imported by the Node test runner.
// eslint-disable-next-line no-restricted-imports
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Alert,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  CredentialFileInput,
  DatePicker,
  DateRangePicker,
  Dialog,
  Dropdown,
  EmptyPlaceholder,
  FileListItemProgressBar,
  FileUploadDropZone,
  FilterSelect,
  initCoreI18n,
  Input,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  PasswordInput,
  Popover,
  PopoverTrigger,
  ProgressBar,
  RadioButton,
  RadioGroup,
  Select,
  Skeleton,
  Slider,
  Table,
  Tabs,
  TextArea,
  TimePicker,
  Toggle,
  Tooltip,
  TreeSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import i18n from 'i18next';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';

const OPTIONS = [
  { id: 'finance', label: 'Finance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'engineering', label: 'Engineering' },
];

const Control = ({ scenario }: { scenario: string }) => {
  const disabled = scenario.endsWith('-disabled');
  const invalid = scenario.endsWith('-invalid');
  const selected = scenario.endsWith('-selected');

  if (scenario.startsWith('alert-')) {
    const variant = scenario.slice('alert-'.length) as
      | 'success'
      | 'warning'
      | 'error'
      | 'brand'
      | 'gray';
    return (
      <Alert
        variant={variant}
        title="Catalog update"
        closable
        rightContent={
          <Button color="secondary" size="sm">
            View details
          </Button>
        }>
        The finance catalog has a new metadata update. Review its ownership and
        data quality before publishing.
      </Alert>
    );
  }
  if (scenario.startsWith('table-')) {
    const columns = [
      { id: 'name', label: 'Asset' },
      { id: 'owner', label: 'Owner' },
      { id: 'status', label: 'Status' },
    ];
    const rows =
      scenario === 'table-empty'
        ? []
        : [
            {
              id: 'orders',
              name:
                scenario === 'table-long'
                  ? 'Finance reporting orders with a deliberately long asset name and wrapped description'
                  : 'Orders',
              owner: 'Analytics',
              status: 'Approved',
            },
            {
              id: 'customers',
              name: 'Customers',
              owner: 'Platform',
              status: 'In review',
            },
          ];
    return (
      <Table
        aria-label="Catalog assets"
        selectionMode="multiple"
        selectedKeys={
          scenario === 'table-selected' ? new Set(['orders']) : new Set()
        }>
        <Table.Header columns={columns}>
          {(col) => (
            <Table.Head
              id={col.id}
              isRowHeader={col.id === 'name'}
              label={col.label}
            />
          )}
        </Table.Header>
        <Table.Body
          items={rows}
          renderEmptyState={() => (
            <Box className="tw:relative tw:h-64 tw:w-full">
              <EmptyPlaceholder
                title="No assets yet"
                description="Add an asset to begin reviewing metadata."
              />
            </Box>
          )}>
          {(row) => (
            <Table.Row id={row.id} columns={columns}>
              {(col) => (
                <Table.Cell>{row[col.id as keyof typeof row]}</Table.Cell>
              )}
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    );
  }
  if (scenario.startsWith('autocomplete-')) {
    return (
      <Autocomplete
        label="Owners"
        items={scenario.endsWith('-empty') ? [] : OPTIONS}
        selectedItems={selected ? [OPTIONS[0]] : []}
        isDisabled={disabled}
        isInvalid={invalid}
        placeholder="Select owners">
        {(item) => <Select.Item id={item.id} label={item.label} />}
      </Autocomplete>
    );
  }
  if (scenario.startsWith('tree-')) {
    const nodes = [
      {
        id: 'finance',
        label: 'Finance',
        value: 'finance',
        children: [
          {
            id: 'revenue',
            label: 'Revenue reporting',
            value: 'revenue',
            isLeaf: true,
          },
        ],
      },
    ];
    return (
      <TreeSelect
        data-testid="control-trigger"
        label="Domains"
        searchable
        fetchData={async () => ({ nodes })}
        value={selected ? nodes : []}
        disabled={disabled}
      />
    );
  }
  if (scenario.startsWith('filter-')) {
    return (
      <FilterSelect
        data-testid="control-trigger"
        label="Owners"
        options={
          scenario.endsWith('-empty')
            ? []
            : OPTIONS.map((item, i) => ({
                value: item.id,
                label: item.label,
                count: 12 - i,
              }))
        }
        selectedValues={selected ? ['finance'] : []}
        onChange={() => undefined}
        isDisabled={disabled}
        searchable
        commitMode="staged"
      />
    );
  }
  if (scenario.startsWith('date-')) {
    return (
      <DatePicker
        aria-label="Start date"
        isDisabled={disabled}
        isInvalid={invalid}
        triggerVariant={
          scenario.endsWith('-input') || invalid ? 'input' : 'button'
        }
      />
    );
  }
  if (scenario.startsWith('range-')) {
    return (
      <DateRangePicker aria-label="Reporting period" isDisabled={disabled} />
    );
  }
  if (scenario.startsWith('time-')) {
    return (
      <TimePicker
        label="Run at"
        value={scenario.endsWith('-empty') ? null : { hour: 10, minute: 30 }}
        isDisabled={disabled}
        isInvalid={invalid}
        hint={invalid ? 'Enter a valid time.' : 'Scheduled in UTC.'}
      />
    );
  }
  if (scenario.startsWith('upload-')) {
    return (
      <FileUploadDropZone
        hint="JSON and PEM files up to 1 MB"
        accept=".json,.pem"
        isDisabled={disabled}
        isInvalid={invalid}
      />
    );
  }
  if (scenario.startsWith('file-')) {
    return (
      <FileListItemProgressBar
        name="finance-catalog.json"
        size={4096}
        progress={scenario.endsWith('-uploading') ? 42 : 100}
        failed={scenario.endsWith('-error')}
        onDelete={() => undefined}
        onRetry={() => undefined}
      />
    );
  }
  if (scenario.startsWith('credential-')) {
    return (
      <CredentialFileInput
        label="Service credentials"
        hint={
          invalid
            ? 'A valid credential file is required.'
            : 'Upload a JSON service account file.'
        }
        allowManualInput={scenario.endsWith('-manual')}
        hasStoredValue={scenario.endsWith('-stored')}
        value={scenario.endsWith('-manual') ? 'example-placeholder' : undefined}
        isDisabled={disabled}
        isInvalid={invalid}
      />
    );
  }
  if (scenario.startsWith('accordion-')) {
    return (
      <Accordion
        defaultExpandedKeys={scenario.endsWith('-expanded') ? ['metadata'] : []}
        isDisabled={disabled}>
        <AccordionItem id="metadata">
          <AccordionHeader>Metadata configuration</AccordionHeader>
          <AccordionPanel>
            Collect table descriptions, owners and classification tags.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
  }
  if (scenario.startsWith('breadcrumbs-')) {
    return (
      <Breadcrumbs
        maxItems={scenario === 'breadcrumbs-default' ? undefined : 2}
        items={[
          { id: 'catalog', label: 'Catalog', href: '#catalog' },
          { id: 'warehouse', label: 'Finance warehouse', href: '#warehouse' },
          { id: 'schema', label: 'Public schema', href: '#schema' },
          { id: 'orders', label: 'Orders' },
        ]}
      />
    );
  }
  if (scenario.startsWith('pagination-')) {
    return (
      <PaginationCardWithControls
        page={
          scenario.endsWith('-last') ? 10 : scenario.endsWith('-middle') ? 5 : 1
        }
        total={10}
      />
    );
  }
  if (scenario === 'empty-default') {
    return (
      // The placeholder fills its nearest positioned container.
      <Box className="tw:relative tw:h-64 tw:w-full">
        <EmptyPlaceholder
          title="No data assets"
          description="Connect a service to start discovering your metadata."
        />
      </Box>
    );
  }
  if (scenario.startsWith('input-')) {
    return (
      <Input
        data-testid="control-input"
        defaultValue={scenario.endsWith('-filled') ? 'Revenue analytics' : ''}
        hint={
          invalid ? 'Enter a catalog name.' : 'Used to identify this catalog.'
        }
        isDisabled={disabled}
        isInvalid={invalid}
        label="Catalog name"
        placeholder="Enter catalog name"
      />
    );
  }
  if (scenario.startsWith('password-')) {
    return (
      <PasswordInput
        defaultValue="example-password"
        isDisabled={disabled}
        label="Connection password"
      />
    );
  }
  if (scenario.startsWith('textarea-')) {
    return (
      <TextArea
        defaultValue="Curated finance assets for reporting and analysis."
        hint={
          invalid ? 'A description is required.' : 'Describe the data asset.'
        }
        isDisabled={disabled}
        isInvalid={invalid}
        label="Description"
      />
    );
  }
  if (scenario.startsWith('select-')) {
    return (
      <Select
        data-testid="control-trigger"
        hint={invalid ? 'Choose a domain.' : undefined}
        isDisabled={disabled}
        isInvalid={invalid}
        items={scenario.endsWith('-empty') ? [] : OPTIONS}
        label="Domain"
        placeholder="Select domain"
        value={selected ? 'finance' : undefined}>
        {(item) => <Select.Item id={item.id} label={item.label} />}
      </Select>
    );
  }
  if (scenario.startsWith('checkbox-')) {
    return (
      <Checkbox
        defaultSelected={selected}
        hint="Include assets inherited from parent domains."
        isDisabled={disabled}
        isIndeterminate={scenario.endsWith('-indeterminate')}
        label="Include inherited assets"
      />
    );
  }
  if (scenario.startsWith('radio-')) {
    return (
      <RadioGroup
        aria-label="Visibility"
        defaultValue="public"
        isDisabled={disabled}>
        <RadioButton label="Public" value="public" />
        <RadioButton label="Private" value="private" />
      </RadioGroup>
    );
  }
  if (scenario.startsWith('toggle-')) {
    return (
      <Toggle
        defaultSelected={selected}
        hint="Automatically collect metadata from this source."
        isDisabled={disabled}
        label="Enable ingestion"
      />
    );
  }
  if (scenario.startsWith('slider-')) {
    return (
      <Slider
        aria-label="Quality score"
        defaultValue={75}
        isDisabled={disabled}
      />
    );
  }
  if (scenario.startsWith('buttons-')) {
    return (
      <Box gap={3}>
        <Button isDisabled={disabled} isLoading={scenario.endsWith('-loading')}>
          Save changes
        </Button>
        <Button color="secondary" isDisabled={disabled}>
          Cancel
        </Button>
        <Button color="primary-destructive" isDisabled={disabled}>
          Delete
        </Button>
      </Box>
    );
  }
  if (scenario === 'dropdown-open') {
    return (
      <Dropdown.Root>
        <Button data-testid="control-trigger">Manage asset</Button>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Asset actions">
            <Dropdown.Item id="edit" label="Edit metadata" />
            <Dropdown.Item id="export" label="Export" />
            <Dropdown.Item id="delete" label="Delete asset" />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    );
  }
  if (scenario === 'popover-open') {
    return (
      <PopoverTrigger>
        <Button data-testid="control-trigger">Asset information</Button>
        <Popover aria-label="Asset information">
          <Box className="tw:p-4" direction="col" gap={2}>
            <Typography weight="semibold">Revenue analytics</Typography>
            <Typography>Owned by the Analytics team.</Typography>
          </Box>
        </Popover>
      </PopoverTrigger>
    );
  }
  if (scenario === 'tooltip-open') {
    return (
      <Tooltip isOpen title="Only owners can change this setting.">
        <Button data-testid="control-trigger">Edit ownership</Button>
      </Tooltip>
    );
  }
  if (scenario === 'modal-open') {
    return (
      <ModalOverlay isOpen>
        <Modal>
          <Dialog aria-label="Edit asset" width={480} onClose={() => undefined}>
            <Dialog.Header>
              <Typography as="h2" weight="semibold">
                Edit asset
              </Typography>
            </Dialog.Header>
            <Dialog.Content>
              <Input defaultValue="Revenue analytics" label="Display name" />
            </Dialog.Content>
            <Box className="tw:p-6" gap={3}>
              <Button color="secondary">Cancel</Button>
              <Button>Save changes</Button>
            </Box>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
  }
  if (scenario === 'tabs-default') {
    return (
      <Tabs aria-label="Asset detail tabs" defaultSelectedKey="schema">
        <Tabs.List>
          <Tabs.Item id="schema">Schema</Tabs.Item>
          <Tabs.Item id="quality">Data quality</Tabs.Item>
          <Tabs.Item id="lineage">Lineage</Tabs.Item>
        </Tabs.List>
      </Tabs>
    );
  }
  if (scenario === 'badges-default') {
    return (
      <Box gap={3}>
        <Badge color="brand">Draft</Badge>
        <Badge color="success">Approved</Badge>
        <Badge color="warning">In review</Badge>
        <Badge color="error">Failed</Badge>
        <Avatar initials="FS" size="md" />
      </Box>
    );
  }
  if (scenario === 'progress-default') {
    return <ProgressBar value={75} />;
  }
  if (scenario === 'skeleton-loading') {
    return (
      <Box direction="col" gap={3}>
        <Skeleton className="tw:h-6 tw:w-48" />
        <Skeleton className="tw:h-4 tw:w-full" />
        <Skeleton className="tw:h-4 tw:w-72" />
      </Box>
    );
  }

  throw new Error(`Unknown visual control scenario: ${scenario}`);
};

const root = document.getElementById('root');
if (!root?.dataset.scenario) {
  throw new Error('A visual control scenario is required.');
}
const scenario = root.dataset.scenario;

void i18n
  .use(initReactI18next)
  .init({ lng: 'en-US', fallbackLng: 'en-US' })
  .then(() => {
    initCoreI18n(i18n);
    createRoot(root).render(
      <Box
        className="tw:mx-auto tw:mt-24 tw:w-full tw:max-w-2xl tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-6 tw:text-primary"
        data-testid="visual-control"
        direction="col"
        gap={4}>
        <Typography as="h1" size="text-lg" weight="semibold">
          Metadata controls
        </Typography>
        <Control scenario={scenario} />
      </Box>
    );
  });
