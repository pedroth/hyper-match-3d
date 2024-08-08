FROM node:22
# RUN apt -y update
# RUN apt install -y libsdl2-2.0-0 pulseaudio ffmpeg alsa-utils
# Set the working directory in the container
WORKDIR /usr/src/app
# Copy package.json and package-lock.json
COPY package*.json ./
# Install dependencies
RUN npm install
# Copy the rest of the application code
COPY . .
# Expose the application port
EXPOSE 3000
# Define the command to run the application
CMD ["npm", "run", "start_docker"]
