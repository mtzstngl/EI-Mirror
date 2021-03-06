"use strict";

/**
 * Visualisiert die aktuelle Handposition mit einem Kreis.
 * Wenn der Kreis lange genug über einer Konfigurierten Position ist wird
 * eine "PAGE_CHANGED"-Benachrichtigung and das MMM-pages Modul gesendet,
 * damit zu einer neuen Seite gewechselt wird.
 * Die Position und die Zielseite können alle konfiguriert werden.
 * Die Handposition wird von einem Pythonmodul ermittelt und über node_helper.js
 * and diese Datei gesendet.
 * Das öffnen einer App wird simuliert, indem man auf einen andere Seite wechselt,
 * welches ein Modul enthält das mehr Informationen anzeigt.
 */
Module.register("EI-Mirror", {

	// Default module config.
	defaults: {
	},

	status: {
		x: 0,
		y: 0,
		z: 0,
		visible: true,
		startTimer: false
	},

	medicine_scanning: false,

	// Contains a DomRect with the size of each possible module region
	moduleRegions: {},

	// A reference to the used pages module
	pagesModule: {},

	start: function() {
		const self = this;

		// We need to send a notification to the node_helper in order to establish the socket connection
		// After this the node_helper can send notifications to the module
		self.sendSocketNotification("START");
	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");
		wrapper.id = "eiMirrorWrapper";
		return wrapper;
	},

	// https://github.com/MichMich/MagicMirror/blob/master/modules/README.md
	// p5.js Dateien, damit der Kreis gemalt werden kann.
	getScripts: function()  {
		return [
			"p5.min.js",
			"p5.dom.min.js",
			"p5.sound.min.js"
		];
	},

	// update the moduleRegion -> Needed for position changes that don't trigger update
	updateElement: function(className) {
		const self = this;

		let element = document.getElementsByClassName(className)[0];
		if (element)
			self.moduleRegions[className] = element.getBoundingClientRect();
	},

	// Is called if this module receives a notification from another module
	notificationReceived: function(notification, payload, sender) {
		const self = this;
		// Start p5.js when the DOM is ready
		switch (notification) {
		case "UPDATE_OBS_ELEMENT":
			self.updateElement(payload);
			break;
		case "ALL_MODULES_STARTED":
			// Get the MMM-pages module in order to get information from it
			self.pagesModule = MM.getModules().withClass("MMM-pages")[0];
			break;
		case "DOM_OBJECTS_CREATED":
			Log.info("DOM objects are created. Starting P5 …");

			// Register every relevant region. fullscreen and bar are ignored because normally no app is inside these.
			// This keeps track of the sizes of every region where a module could be, even if the module inside has no function
			let regionClasses = [
				"region top left", "region top center", "region top right",
				"region upper third", "region middle center", "region lower third",
				"region bottom left", "region bottom center", "region bottom right",
				"specialmedicine", "yesButton", "noButton", "ei_medicineButton"
			];

			// Callback when an observed element changed size. Update global size dictionary
			var observerCallback = function(entries) {
				for(let entry of entries) {
					self.moduleRegions[entry.target.className] = entry.target.getBoundingClientRect();
				}
			};

			// Get each relevant region and use a ResizeObserver to detect any size changes
			var observer = new ResizeObserver(observerCallback);
			for (let regionClass of regionClasses) {
				let element = document.getElementsByClassName(regionClass)[0];
				self.moduleRegions[regionClass] = element.getBoundingClientRect();
				observer.observe(element);
			}

			let sketch = this.makeSketch();
			new p5(sketch, "eiMirrorWrapper");
			break;
		default:
			break;
		}
	},

	// This contains the p5.js sketch
	makeSketch: function() {
		const self = this;
		return function(p5) {
			let canvas;
			let rotation = 0;
			let diameter = 0;
			let openApp = true;
			let handsPreviouslyVisible = false;

			p5.setup = function() {
				// Default background is transparent
				canvas = p5.createCanvas(p5.windowWidth, p5.windowHeight);
				// Set framerate to 30 since TV/HDMI/PC combination doesn't allow more
				p5.frameRate(30);
			};

			// Gets which maps (from config) are relevant for the current page
			function GetActiveMaps(currentPage) {
				let activeMaps = [];

				for (let i = 0; i < self.config.appMap.length; i++) {
					if (self.config.appMap[i].visiblePages.includes(currentPage)) {
						activeMaps.push(self.config.appMap[i]);
					}
				}

				return activeMaps;
			}

			// This checks if the x and y position are inside a region that is mapped.
			function GetInsideRegion(x, y) {
				let activeMaps = GetActiveMaps(self.pagesModule.curPage);

				for (let i = 0; i < activeMaps.length; i++) {
					if (x <= self.moduleRegions[activeMaps[i].region].right && x >= self.moduleRegions[activeMaps[i].region].left) {
						if (y <= self.moduleRegions[activeMaps[i].region].bottom && y >= self.moduleRegions[activeMaps[i].region].top) {
							return activeMaps[i];
						}
					}
				}

				return null;
			}

			p5.draw = function() {
				p5.clear();

				let xPosition = 0;
				let yPosition = 0;
				let zPosition = 0;
				if (!self.medicine_scanning){
					// Use mouse position
					xPosition = p5.mouseX;
					yPosition = p5.mouseY;
					// Use position from python script
					//xPosition = self.status["x"];
					//yPosition = self.status["y"];
					zPosition = self.status["z"];
				}

				// Send Notification to info module about instructions
				if (handsPreviouslyVisible && !self.status["visible"]) {
					self.sendNotification("NO_HAND_VISIBLE");
				} else if (!handsPreviouslyVisible && self.status["visible"]) {
					self.sendNotification("HAND_VISIBLE");
				}
				handsPreviouslyVisible = self.status["visible"];

				if (self.status["visible"]) {
					let map = GetInsideRegion(xPosition, yPosition);

					if (map != null) {
						// draw the inner circle
						p5.noStroke();
						p5.fill(255);
						p5.ellipse(xPosition, yPosition, diameter, diameter);
						if (diameter >= (zPosition + 15)) {
							// Draw checkmark after the "loading" has completed
							p5.strokeWeight(4);
							p5.stroke(0);
							let pos1 = (zPosition + 10) / 10; // originally ~5
							let pos2 = (zPosition + 10) / 5; // originally ~10
							let pos3 = (zPosition + 10) / 3; // originally ~15
							p5.line(xPosition - pos2, yPosition + pos1, xPosition, yPosition + pos3);
							p5.line(xPosition, yPosition + pos3, xPosition + pos2, yPosition - pos3);
							if (openApp) {
								setTimeout(function() {
									let notifyName = "PAGE_CHANGED";

									if (map.customNotification) {
										notifyName = map.customNotification;
									}
									if (notifyName == "MED_START_SCANNING") {
										self.medicine_scanning = true;
										setTimeout(function() {
											self.medicine_scanning = false;
										}, 7000);
									}
									self.sendNotification(notifyName, map.targetPage); // Open App after 250ms
								}, 250);
								openApp = false;
							}
						} else {
							diameter += 2;
							openApp = true;
						}
					} else {
						diameter = 0;
					}

					// Draw the non complete circle
					p5.noFill();
					p5.strokeWeight(4);
					p5.stroke(255);
					p5.arc(xPosition, yPosition, zPosition + 10, zPosition + 10, p5.radians(rotation), p5.radians(270 + rotation));

					// advance the rotation
					rotation = (rotation + 6) % 360;
				} else {

				}
			};

			p5.windowResized = function() {
				canvas = p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
			};
		};
	},

	// Is called if we receive a notification from our node_helper.js
	socketNotificationReceived: function(notification, payload) {
		const self = this;

		//Log.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);
		switch (notification) {
		case "STATUS": // Got new output from the python module about the current hand position.
			self.status = payload;
			if (self.status.startTimer == true) {
				self.sendNotification("START_TIMER");
			} else if (self.status.startTimer == false) {
				self.sendNotification("STOP_TIMER");
			}
			break;
		case "ERROR":
			self.sendNotification("SHOW_ALERT", {title: "FEHLER!", message: payload, timer: 10000});
			break;
		case "CRASH":
			self.sendNotification("SHOW_ALERT", {title: "FEHLER!", message: payload});
			break;
		}
	},
});