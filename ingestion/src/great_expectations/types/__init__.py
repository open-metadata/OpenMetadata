from .configurations import ClassConfig


class DictDot:
    def __getitem__(self, item):
        if isinstance(item, int):
            return list(self.__dict__.keys())[item]
        return getattr(self, item)

    def __setitem__(self, key, value):
        setattr(self, key, value)

    def __delitem__(self, key):
        delattr(self, key)


class SerializableDictDot(DictDot):
    def to_json_dict(self) -> dict:
        raise NotImplementedError
