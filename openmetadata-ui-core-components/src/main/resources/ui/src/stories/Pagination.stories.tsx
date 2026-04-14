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
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  PaginationButtonGroup,
  PaginationCardDefault,
  PaginationCardMinimal,
  PaginationPageDefault,
  PaginationPageMinimalCenter,
} from '../components/application/pagination/pagination';

const meta = {
  title: 'Components/Pagination',
  component: PaginationPageDefault,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PaginationPageDefault>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageDefault: Story = {
  render: () => {
    const [page, setPage] = useState(1);

    return (
      <PaginationPageDefault page={page} total={10} onPageChange={setPage} />
    );
  },
};

export const PageDefaultRounded: StoryObj = {
  render: () => {
    const [page, setPage] = useState(5);

    return (
      <PaginationPageDefault
        rounded
        page={page}
        total={10}
        onPageChange={setPage}
      />
    );
  },
};

export const PageMinimalCenter: StoryObj = {
  render: () => {
    const [page, setPage] = useState(3);

    return (
      <PaginationPageMinimalCenter
        page={page}
        total={10}
        onPageChange={setPage}
      />
    );
  },
};

export const CardDefault: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);

    return (
      <div style={{ width: 600 }}>
        <PaginationCardDefault page={page} total={10} onPageChange={setPage} />
      </div>
    );
  },
};

export const CardMinimal: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);

    return (
      <div style={{ width: 600 }}>
        <PaginationCardMinimal page={page} total={10} onPageChange={setPage} />
      </div>
    );
  },
};

export const ButtonGroup: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);

    return (
      <div style={{ width: 600 }}>
        <PaginationButtonGroup page={page} total={10} onPageChange={setPage} />
      </div>
    );
  },
};
