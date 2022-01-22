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
Backup utility for the metadata CLI
"""
import subprocess
from typing import Optional


def run_backup(
    host: str,
    user: str,
    password: str,
    upload: Optional[str] = None,
) -> None:
    """
    Run `mysqldump` to MySQL database and store the
    output. Optionally, upload it to S3.

    :param host: database host
    :param user: database user
    :param password: database pwd
    :param upload: URI to upload result file
    """

    subprocess.Popen(["echo", host, user, password])
