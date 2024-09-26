"""
A custom dictionary class that extends functionality.
"""


class ExtendedDict(dict):
    def lower_case_keys(self):
        return {k.lower(): v for k, v in self.items()}
