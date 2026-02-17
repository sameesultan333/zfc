from flask import Flask, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

ZONE_DATA = {
    "timestamp": int(time.time()),
    "payload": {
        "temperature": 16.9,
        "humidity": 33.4,
        "lux": 6551.6,
        "ph": 24.0,
        "ec": 0.1,
        "water_level": 1,
        "fan_status": 1,
        "light_status": 1,
        "curtain_status": 1,
        "valve_status": 0,
        "water_pump_status": 0,
        "fogger_status": 1,
        "tp4_temperature": 18.2,
        "ec_a": 0.4,
        "ec_b": 0.6,
        "macro_status": 1,
        "micro_status": 0,
    }
}

SM_DATA = {
    "no_of_soil_sensors": 4,
    "payload": {
        "soil_moisture_1": 45,
        "soil_moisture_2": 47,
        "soil_moisture_3": 44,
        "soil_moisture_4": 46
    }
}

SETPOINTS = {
    "LUX-MINsetpoint": 3000,
    "LUX-MAXsetpoint": 7000,
    "EC-setpoint": 1.5
}

@app.route("/data", methods=["GET"])
def data():
    ZONE_DATA["timestamp"] = int(time.time())
    return jsonify(ZONE_DATA)

@app.route("/data/1/sm", methods=["GET"])
def sm():
    return jsonify(SM_DATA)

@app.route("/data/1/setpoints", methods=["GET"])
def setpoints():
    return jsonify(SETPOINTS)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3090, debug=True)