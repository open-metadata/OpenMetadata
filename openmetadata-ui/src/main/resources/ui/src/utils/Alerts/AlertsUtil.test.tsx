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
import { getAlertBody, getFunctionDisplayName } from './AlertsUtil';

describe('AlertsUtil tests', () => {
  it('getFunctionDisplayName should return correct text for matchAnyEntityFqn', () => {
    expect(getFunctionDisplayName('matchAnyEntityFqn')).toBe(
      'label.fqn-uppercase'
    );
  });

  it('getFunctionDisplayName should return correct text for matchAnyOwnerName', () => {
    expect(getFunctionDisplayName('matchAnyOwnerName')).toBe('label.owner');
  });

  it('getFunctionDisplayName should return correct text for matchAnyEventType', () => {
    expect(getFunctionDisplayName('matchAnyEventType')).toBe(
      'label.event-type'
    );
  });

  it('getFunctionDisplayName should return correct text for matchTestResult', () => {
    expect(getFunctionDisplayName('matchTestResult')).toBe('label.test-entity');
  });

  it('getFunctionDisplayName should return correct text for matchUpdatedBy', () => {
    expect(getFunctionDisplayName('matchUpdatedBy')).toBe('label.updated-by');
  });

  it('getFunctionDisplayName should return correct text for matchAnySource', () => {
    expect(getFunctionDisplayName('matchAnySource')).toBe('label.source-match');
  });

  it('getFunctionDisplayName should return correct text for matchAnyEntityId', () => {
    expect(getFunctionDisplayName('matchAnyEntityId')).toBe(
      'label.entity-id-match'
    );
  });

  describe('getAlertBody', () => {
    it('should render title, icon description and actions if passed when call it', () => {
      render(
        getAlertBody({
          title: 'Alert Title',
          icon: 'Alert Icon',
          description: 'Alert Description',
          actions: 'Alert Actions',
        })
      );

      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert Icon')).toBeInTheDocument();
      expect(screen.getByText('Alert Description')).toBeInTheDocument();
      expect(screen.getByText('Alert Actions')).toBeInTheDocument();
    });
  });
});
