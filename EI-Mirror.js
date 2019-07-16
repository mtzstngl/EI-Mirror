"use strict";

Module.register("EI-Mirror", {

	// Default module config.
	defaults: {
	},

	status: {
		x: 0,
		y: 0,
		visible: true
	},

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
	getScripts: function()  {
		return [
			"p5.min.js",
			"p5.dom.min.js",
			"p5.sound.min.js"
		];
	},

	// Is called if this module receives a notification from another module
	notificationReceived: function(notification, payload, sender) {
		const self = this;
		// Start p5.js when the DOM is ready
		switch (notification) {
		case "ALL_MODULES_STARTED":
			// TODO(MSt): Get data from MMM-pages and map modules to regions and current page number
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
				"region bottom left", "region bottom center", "region bottom right"
			];

			// Callback when an observed element changed size. Update global size dictionary
			var observerCallback = function(entries) {
				for(let entry of entries) {
					self.moduleRegions[entry.target.className] = entry.target.getBoundingClientRect();
				}
			}

			// Get each relevant region and use a ResizeObserver to detect any size changes
			for (let regionClass of regionClasses) {
				let element = document.getElementsByClassName(regionClass)[0];
				self.moduleRegions[regionClass] = element.getBoundingClientRect();
				var observer = new ResizeObserver(observerCallback);
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

				let xPosition = p5.mouseX;
				let yPosition = p5.mouseY;
				//let xPosition = self.status["x"];
				//let yPosition = self.status["y"];

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
						if (diameter >= 55) {
							// Draw checkmark after the "loading" has completed
							p5.strokeWeight(4);
							p5.stroke(0);
							p5.line(xPosition - 10, yPosition + 5, xPosition, yPosition + 15);
							p5.line(xPosition, yPosition + 15, xPosition + 10, yPosition - 15);
							if (openApp) {
								setTimeout(function() {
									self.sendNotification("PAGE_CHANGED", map.targetPage); // Open App after 250ms
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
					p5.arc(xPosition, yPosition, 50, 50, p5.radians(rotation), p5.radians(270 + rotation));

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
			break;
		}
	},
});