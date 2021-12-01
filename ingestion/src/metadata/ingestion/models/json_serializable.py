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

import abc
import json

NODE_KEY = "KEY"
NODE_LABEL = "LABEL"
NODE_REQUIRED_HEADERS = {NODE_LABEL, NODE_KEY}


class JsonSerializable(object, metaclass=abc.ABCMeta):
    def __init__(self) -> None:
        pass

    @staticmethod
    def snake_to_camel(s):
        # change property names like first_name to firstName
        # property names that are already in camelCase like isBot are unchanged
        a = s.split("_")
        if len(a) > 1:
            a[0] = a[0].lower()
            a[1:] = [u.title() for u in a[1:]]
        return "".join(a)

    @staticmethod
    def serialize(obj):
        return {JsonSerializable.snake_to_camel(k): v for k, v in obj.__dict__.items()}

    def to_json(self):
        return json.dumps(
            JsonSerializable.serialize(self),
            indent=4,
            default=JsonSerializable.serialize,
        )
