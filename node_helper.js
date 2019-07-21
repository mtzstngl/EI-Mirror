var NodeHelper = require("node_helper");
const {PythonShell} = require("python-shell");

/**
 * Ruft mittels PythonShell GestureRecognition.py auf, welches die aktuelle Handposition tracked.
 * Die Ergebnisse des Tracking werden mittels JSON ausgetauscht.
 * JSON Object:
 * {
 *   "x":  0, # 0 <= x <= 1920
 *   "y": 0, # 0 <= y <= 1080
 *   "visible": True # Is Hand visible?
 * }
 */
module.exports = NodeHelper.create({

	// System is ready to boot
	start: function() {
		const self = this;

		let options = {
			mode: "json",
			scriptPath: "modules/EI-Mirror",
			pythonOptions: ["-u"] // This is needed otherwise we don't receive the output until the process has ended
		};

		const shell = new PythonShell("GestureRecognition.py", options);

		// Received output from python script; send it to the main module.
		shell.on("message", function (message) {
			//console.log("MESSAGE: " + JSON.stringify(message));
			self.sendSocketNotification("STATUS", message);
		});
		shell.on("stderr", function (stderr) {
			console.log("STDERR: " + stderr);
		});
		shell.on("error", function (error) {
			console.log("ERROR: " + error);
		});
		shell.on("close", function () {
			console.log("CLOSE");
		});

		console.log("EI-Mirror node_helper started");
	},

	// System is shutting down
	stop: function() {
		console.log("EI-Mirror node_helper stopped");
	},

	// My module (EI-Mirror.js) has sent a notification
	socketNotificationReceived: function(notification, payload) {
		console.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);
	},
});