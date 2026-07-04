#!/bin/bash

echo "🔐 Generating self-signed SSL certificate for websockify..."
openssl req -x509 -newkey rsa:2048 -keyout /app/self.pem -out /app/self.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "🚀 Starting Virtual Framebuffer (Xvfb) on display :99..."
Xvfb :99 -screen 0 1280x720x16 &
export DISPLAY=:99

echo "🚀 Starting window manager (fluxbox)..."
fluxbox &

echo "🚀 Starting VNC server (x11vnc) on port 5900..."
x11vnc -display :99 -nopw -forever -shared -bg

echo "🚀 Starting noVNC proxy (websockify) on port 6080 with SSL..."
websockify --web /usr/share/novnc --cert /app/self.pem 6080 localhost:5900 &

echo "🚀 Starting AI Agent node application..."
node index_local.js
