FROM openjdk:11

EXPOSE 8585 3306

RUN apt-get update -y && \
    apt-get install --no-install-recommends curl unzip git -y && \
    rm -rf /var/lib/apt/lists/*

#Need to add pom.xml for maven dependency installation  

ADD /dist/target/catalog-1.0.0-SNAPSHOT.tar.gz /
COPY /docker/metadata/catalog-start.sh /
COPY /docker/metadata/catalog.yaml /
RUN chmod 777 /catalog-start.sh

WORKDIR /


CMD ["./catalog-start.sh"]
