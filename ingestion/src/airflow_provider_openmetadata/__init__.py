import metadata


def get_provider_config():
    import yaml
    with open("./provider.yaml") as f:
        return yaml.safe_load(f)
