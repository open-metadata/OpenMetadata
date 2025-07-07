#  Copyright 2025 Collate
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
DF Reader common methods
"""
from metadata.utils.constants import CHUNKSIZE


def dataframe_to_chunks(df: "DataFrame"):
    """
    Reads the Dataframe and returns list of dataframes broken down in chunks
    """
    return [
        df[range_iter : range_iter + CHUNKSIZE]
        for range_iter in range(0, len(df), CHUNKSIZE)
    ]
