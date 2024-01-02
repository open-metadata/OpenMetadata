#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Map Types to convert/cast mssql related data types to relevant data types
"""


from sqlalchemy import NVARCHAR, TEXT

from metadata.profiler.orm.registry import CustomImage

cast_dict = {
    CustomImage: "VARBINARY(max)",
    TEXT: "VARCHAR(max)",
    NVARCHAR: "NVARCHAR(max)",
}
