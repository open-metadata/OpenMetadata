from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer
from great_expectations.render.renderer.site_builder import (
    DefaultSiteIndexBuilder,
    DefaultSiteSectionBuilder,
    SiteBuilder,
)


class SiteBuilderAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)
        self._ge_classes = [
            SiteBuilder,
            DefaultSiteSectionBuilder,
            DefaultSiteIndexBuilder,
        ]

    def anonymize_site_builder_info(self, site_builder_config):
        class_name = site_builder_config.get("class_name")
        module_name = site_builder_config.get("module_name")
        if module_name is None:
            module_name = "great_expectations.render.renderer.site_builder"

        anonymized_info_dict = {}
        self.anonymize_object_info(
            object_config={"class_name": class_name, "module_name": module_name},
            anonymized_info_dict=anonymized_info_dict,
            ge_classes=self._ge_classes,
        )

        return anonymized_info_dict
