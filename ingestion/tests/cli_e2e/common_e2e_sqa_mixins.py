#  Copyright 2022 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Add Common E2E Sqlalchemy Mixins
"""


class SQACommonMethods:
    def create_table_and_view(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(self.create_table_query)
            for insert_query in self.insert_data_queries:
                connection.execute(insert_query)
            connection.execute(self.create_view_query)
            connection.close()

    def delete_table_and_view(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(self.drop_view_query)
            connection.execute(self.drop_table_query)
            connection.close()

    def run_update_queries(self) -> None:
        with self.engine.connect() as connection:
            for update_query in self.update_queries():
                connection.execute(update_query)
            connection.close()

    def run_delete_queries(self) -> None:
        with self.engine.connect() as connection:
            for drop_query in self.delete_queries():
                connection.execute(drop_query)
            connection.close()
