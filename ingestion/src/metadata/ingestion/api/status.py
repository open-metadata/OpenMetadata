import json
import pprint
from dataclasses import dataclass


@dataclass
class Status:
    def as_obj(self) -> dict:
        return self.__dict__

    def as_string(self) -> str:
        return pprint.pformat(self.as_obj(), width=150)

    def as_json(self) -> str:
        return json.dumps(self.as_obj())