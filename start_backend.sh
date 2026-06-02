#!/bin/bash
echo "Starting Supply Chain AI Backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
