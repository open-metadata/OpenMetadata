/*
 *  Copyright 2022 Collate.
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

import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { DEFAULT_FORM_VALUE } from '../../constants/Tags.constant';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import TagsForm from './TagsForm';

jest.mock('../../components/common/RichTextEditor/RichTextEditor', () => {
  return jest.fn().mockImplementation(({ initialValue }) => {
    return <div>{initialValue}MarkdownWithPreview component</div>;
  });
});

jest.mock('../../utils/CommonUtils', () => ({
  isUrlFriendlyName: jest.fn().mockReturnValue(true),
  getCountBadge: jest.fn().mockReturnValue(''),
}));

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: false,
    },
  })),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn().mockReturnValue({
    activeDomainEntityRef: undefined,
  }),
}));

jest.mock('../../rest/domainAPI', () => ({
  searchData: jest.fn().mockResolvedValue({
    data: { hits: { hits: [] } },
  }),
}));

const mockSubmit = jest.fn();

// Create a wrapper component to use the form hook
const TestWrapper = ({
  showMutuallyExclusive = false,
  isClassification = false,
}: {
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
}) => {
  const [formRef] = Form.useForm<Classification | Tag | undefined>();

  return (
    <TagsForm
      isEditing
      formRef={formRef}
      initialValues={{
        ...DEFAULT_FORM_VALUE,
        autoClassificationConfig: {
          enabled: false,
        },
      }}
      isClassification={isClassification}
      isSystemTag={false}
      isTier={false}
      showMutuallyExclusive={showMutuallyExclusive}
      onSubmit={mockSubmit}
    />
  );
};

describe('TagForm component', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
  });

  it('Form component should render properly', async () => {
    render(<TestWrapper />);

    const form = await screen.findByTestId('tags-form');
    const name = await screen.findByTestId('name');

    expect(form).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(
      await screen.findByText(/MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });

  it('Form component should render name and displayName fields', async () => {
    render(<TestWrapper />);

    const nameField = await screen.findByTestId('name');
    const displayNameField = await screen.findByTestId('displayName');

    expect(nameField).toBeInTheDocument();
    expect(displayNameField).toBeInTheDocument();
  });

  it('Form component should render Mutually Exclusive field when showMutuallyExclusive is true', async () => {
    const { container } = render(
      <TestWrapper isClassification showMutuallyExclusive />
    );

    // Check for the Form.Item with id that contains mutuallyExclusive
    const mutuallyExclusiveFormItem = container.querySelector(
      '#tags_mutuallyExclusive'
    );

    expect(mutuallyExclusiveFormItem).toBeInTheDocument();
  });

  it('Form component should not render Mutually Exclusive field when showMutuallyExclusive is false', async () => {
    render(<TestWrapper showMutuallyExclusive={false} />);

    const mutuallyExclusiveButton = screen.queryByTestId(
      'mutually-exclusive-button'
    );

    expect(mutuallyExclusiveButton).not.toBeInTheDocument();
  });
});
