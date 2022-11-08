class DatalakeInterfaceMixin:
    """Datalake Inteface mixin grouping shared methods between sequential and threaded executor"""

    @property
    def table(self):
        """OM Table entity"""
        return self._table
