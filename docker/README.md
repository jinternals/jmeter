#Build container Images
docker build -t jenkins-master jenkins-master/.
docker build -t jenkins-data jenkins-data/.

#Run data volume container
docker run --name=jenkins-data-container jenkins-data

#Run container with data-vloume name jenkins-master-container
docker run -p 8080:8080 -p 50000:50000 --name=jenkins-master-container --volumes-from=jenkins-data-container -d jenkins-master

#Pull File from container
docker cp jenkins-data-container:/var/log/jenkins/jenkins.log jenkins.log
