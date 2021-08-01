import abc
import json

NODE_KEY = 'KEY'
NODE_LABEL = 'LABEL'
NODE_REQUIRED_HEADERS = {NODE_LABEL, NODE_KEY}


class JsonSerializable(object, metaclass=abc.ABCMeta):

    def __init__(self) -> None:
        pass

    @staticmethod
    def snake_to_camel(s):
        a = s.split('_')
        a[0] = a[0].lower()
        if len(a) > 1:
            a[1:] = [u.title() for u in a[1:]]
        return ''.join(a)

    @staticmethod
    def serialize(obj):
        return {JsonSerializable.snake_to_camel(k): v for k, v in obj.__dict__.items()}

    def to_json(self):
        return json.dumps(JsonSerializable.serialize(self), indent=4, default=JsonSerializable.serialize)
