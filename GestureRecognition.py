#!/bin/env python3
# Simple example that converts a python dict object to json
import sys
import time
import json

# Python dict object
status = {
    "x":  0, # 0 <= x <= 1920
    "y": 0, # 0 <= y <= 1080
    "z": 0, # 0 <= z <= 100 (0 = at display)
    "visible": True,
    "startTimer": True
}

while True:
    status["z"] += 10
    if status["z"] >= 100:
        status["z"] = 0
    status["y"] += 1
    status["x"] += status["y"]
    if status["y"] >= 10:
        status["startTimer"] = False
    print(json.dumps(status))
    time.sleep(2)
