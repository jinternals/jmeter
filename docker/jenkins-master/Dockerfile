FROM jenkins

MAINTAINER Mradul Pandey <mradul.pandey@ingenta.com>

COPY plugins.txt /usr/share/jenkins/plugins.txt
COPY executors.groovy /usr/share/jenkins/ref/init.groovy.d/executors.groovy


USER root
RUN mkdir /var/log/jenkins
RUN chown -R jenkins:jenkins /var/log/jenkins
USER jenkins

ENV JAVA_OPTS="-Xmx8192m"
ENV JENKINS_OPTS="--logfile=/var/log/jenkins/jenkins.log"

RUN /usr/local/bin/plugins.sh /usr/share/jenkins/plugins.txt
