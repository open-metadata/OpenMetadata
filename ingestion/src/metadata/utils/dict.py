class CustomDict(dict):
    def lower_case_keys(self):
        return {k.lower(): v for k, v in self.items()}
