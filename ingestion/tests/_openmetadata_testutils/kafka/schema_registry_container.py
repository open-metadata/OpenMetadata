from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs


class SchemaRegistryContainer(DockerContainer):
    def __init__(
        self,
        image: str = "confluentinc/cp-schema-registry:7.6.0",
        port: int = 8081,
        schema_registry_kafkastore_bootstrap_servers="PLAINTEXT://localhost:9092",
        schema_registry_host_name="localhost",
        **kwargs,
    ) -> None:
        super().__init__(image, **kwargs)
        self.with_env(
            "SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS",
            schema_registry_kafkastore_bootstrap_servers,
        )
        self.with_env("SCHEMA_REGISTRY_HOST_NAME", schema_registry_host_name)
        self.port = port
        self.with_exposed_ports(port)

    def start(self, timeout=30) -> "SchemaRegistryContainer":
        super().start()
        wait_for_logs(self, r".*\Server started.*", timeout=timeout)
        return self

    def get_connection_url(self):
        return (
            f"http://{self.get_container_host_ip()}:{self.get_exposed_port(self.port)}"
        )
