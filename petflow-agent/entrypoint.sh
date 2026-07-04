#!/bin/bash

echo "🚀 Starting Virtual Framebuffer (Xvfb) on display :99..."
Xvfb :99 -screen 0 1280x720x16 &
export DISPLAY=:99

echo "🚀 Starting window manager (fluxbox)..."
fluxbox &

echo "🚀 Starting VNC server (x11vnc) on port 5900..."
x11vnc -display :99 -nopw -forever -shared -bg

echo "🚀 Starting noVNC proxy (websockify) on port 6080..."
websockify --web /usr/share/novnc 6080 localhost:5900 &

echo "🚀 Starting AI Agent node application..."
node index_local.js
