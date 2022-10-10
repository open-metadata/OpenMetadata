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
Status output utilities
"""
import json
import pprint


class Status:
    def as_obj(self) -> dict:
        return self.__dict__

    def as_string(self) -> str:
        return pprint.pformat(self.as_obj(), width=150)

    def as_json(self) -> str:
        return json.dumps(self.as_obj())
