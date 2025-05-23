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

import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { Rule } from '../../../generated/api/policies/createPolicy';
import RuleForm, { RuleFormProps } from './RuleForm';

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicyFunctions: jest.fn().mockImplementation(() => Promise.resolve()),
  getPolicyResources: jest.fn().mockImplementation(() => Promise.resolve()),
  validateRuleCondition: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('../../../utils/StringsUtils', () => ({
  getErrorText: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockRule = {
  name: 'DataConsumerPolicy-EditRule',
  effect: 'allow',
  condition: 'isOwner()',
  resources: ['all'],
  operations: ['ViewAll', 'EditDescription', 'EditTags'],
  description: 'Allow some of the edit operations on a resource for everyone.',
} as Rule;

const setRuleData = jest.fn();

const mockProps = {
  ruleData: mockRule,
  setRuleData,
};

const MockFormComponent = ({ ...mockProps }: RuleFormProps) => {
  return (
    <Form>
      <RuleForm {...mockProps} />
    </Form>
  );
};

describe('Test Rule Form Component', () => {
  it('Should render the rule form fields', async () => {
    render(<MockFormComponent {...mockProps} />);

    const ruleName = await screen.findByTestId('rule-name');

    const resources = await screen.findByTestId('resources');
    const operations = await screen.findByTestId('operations');

    const effect = await screen.findByTestId('effect');

    const condition = await screen.findByTestId('condition');

    expect(ruleName).toBeInTheDocument();
    expect(resources).toBeInTheDocument();
    expect(operations).toBeInTheDocument();
    expect(effect).toBeInTheDocument();
    expect(condition).toBeInTheDocument();
  });

  it('SetRuleData method should work', async () => {
    render(<MockFormComponent {...mockProps} />);

    const ruleName = await screen.findByTestId('rule-name');

    expect(ruleName).toBeInTheDocument();

    fireEvent.change(ruleName, { target: { value: 'RuleName' } });

    expect(setRuleData).toHaveBeenCalled();
  });
});
