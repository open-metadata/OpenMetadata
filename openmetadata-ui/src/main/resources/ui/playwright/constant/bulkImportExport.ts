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
export const BULK_IMPORT_EXPORT_SQL_QUERY = `CREATE OR REPLACE PROCEDURE insert_user_data(user_name varchar, email varchar, age int) RETURNS int NOT NULL LANGUAGE SQL AS $$DECLARE user_id INT;BEGIN
  INSERT INTO users
              (
                          NAME,
                          email,
                          age
              )
              VALUES
              (
                          user_name,
                          email,
                          age
              )
              returning id
  INTO        user_id;

  RETURN user_id;
END;$$;`;

export const RDG_ACTIVE_CELL_SELECTOR = '.rdg-cell[aria-selected="true"]';
