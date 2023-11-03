/*
 *  Copyright 2023 Collate.
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
import { TeamCSVRecord } from '../../components/Team/TeamImportResult/TeamImportResult.interface';
import { MOCK_CSV_GLOSSARY_DATA } from '../../mocks/Glossary.mock';
import { MOCK_CSV_TEAM_DATA } from '../../mocks/Teams.mock';
import { parseCSV } from './EntityImportUtils';

describe('EntityImportUtils', () => {
  it('parseCSV function', () => {
    const teamResult = parseCSV<TeamCSVRecord>(MOCK_CSV_TEAM_DATA.rowData);
    const glossaryResult = parseCSV<TeamCSVRecord>(
      MOCK_CSV_GLOSSARY_DATA.rowData
    );

    expect(teamResult).toStrictEqual(MOCK_CSV_TEAM_DATA.parseData);
    expect(glossaryResult).toStrictEqual(MOCK_CSV_GLOSSARY_DATA.parseData);
  });
});
