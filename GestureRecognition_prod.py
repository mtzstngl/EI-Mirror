#!/usr/bin/env python3
import pyrealsense2 as rs
import numpy as np
import cv2
import json
import time

# Python dict object
status = {
    "x":  0, # 0 <= x <= 1920
    "y": 0, # 0 <= y <= 1080
    "visible": True
}

#referenz 3d punkte von Fernsehecken

oben_links = np.array([0.40, 0.052, 0.57])
unten_links = np.array([0.40, 0.105, 1.00])
oben_rechts = np.array([-0.37, 0.046, 0.55])
unten_rechts = np.array([-0.37, 0.23, 1.02])



#main
try:
    pipe = rs.pipeline()
    config = rs.config()

    config.enable_stream(rs.stream.depth, 640, 480, rs.format.z16, 30)

# Start streaming
    pipe_profil = pipe.start(config)
except:
    print("kamera nicht angeschlossen")
    exit()

last_update = time.time()
counter_filter = 0
x_list = []
y_list = []

try:

    while(True):


        # Wait for a coherent pair of frames: depth and color
        try:
            frames = pipe.wait_for_frames()
            depth_frame = frames.get_depth_frame()
        except:
            print("keine bilder erhalten")
            print("kamera ein und ausstecken")
            exit()

        # Intrinsics & Extrinsics
        depth_intrin = depth_frame.profile.as_video_stream_profile().intrinsics

        # Depth scale - units of the values inside a de
        # pth frame, i.e how to convert the value to units of 1 meter
        depth_sensor = pipe_profil.get_device().first_depth_sensor()
        depth_scale = depth_sensor.get_depth_scale()  #

        if not depth_frame:
            continue

        #speichern als numpy image
        depth_image = np.asanyarray(depth_frame.get_data())
        t_image = np.asanyarray(depth_frame.get_data())  # erzeugen eines images gleicher groesse wie depth_image
        array_min = np.asanyarray(depth_frame.get_data())

        array_min = array_min + 9999    #Zahnputzerekennung
        t_image = t_image * 0 #nur für visualisieerung
        xArray = []
        yArray = []

        for y in range(260, 305):  # y  305 bildschirm 260 weg von bildschirm
            for x in range(50, 600):  # x
                if depth_image.item(y, x) > 550 and depth_image.item(y, x) < 1050:  # 560 oberkannte fernseh, 1000 unterkannte fernseh

                    t_image.itemset((y, x), 255) # für visualisierung
                    yArray.append(y)  # fügt element hinzu für mittelwert bildung
                    xArray.append(x)



        # errechnen des Mittelpunktes
        if len(xArray) > 0 and len(yArray) > 0:
            meanX = np.mean(np.array(xArray))
            meanY = np.mean(np.array(yArray))

            meanX = int(meanX)
            meanY = int(meanY)


            #markieren des mittelpunktes
            for y in range(meanY - 5, meanY + 5):
                for x in range(meanX - 5, meanX + 5):
                    t_image[y, x] = 100

            #3d koordinaten berechnen
            depth_pixel = [meanX, meanY]
            depth = depth_frame.get_distance(meanX, meanY)

            depth_point = rs.rs2_deproject_pixel_to_point(depth_intrin, depth_pixel, depth)
            print(depth_point)

            # ermitteln der x,y koordinaten auf Monitor; 0-Punkt links oben am Fernseher
            x_monitor = oben_links.item(0) - depth_point[0]
            y_monitor = depth_point[2] - oben_links.item(2)
            status["visible"] = True


        else:
            x_monitor = 0
            y_monitor = 0
            status["visible"] = False




        #skalieren der 3d punkte auf bildschirmgroesse 1920x1080
        x_kalibriert = x_monitor * 2493.5
        y_kalibriert = y_monitor * 2511.6 #2571.4

        #print(x_kalibriert)
        #print(y_kalibriert)

        #messwerte sammeln und mitteln das zittern weg ist



        # Zahnputzerkennnung
        for y in range(260, 315):  # y  420 bildschirm 370 weg von bildschirm
            for x in range(380, 490):  # x
                if depth_image.item(y, x) > 1050 and depth_image.item(y, x) < 1250:
                    array_min.itemset((y, x), depth_image.item(y, x))
                else:
                    array_min.itemset((y, x), 9999)

        min_distance = (np.min(array_min))  # verarbeitung zahnbuerste
        # print(min_distance)

        if (min_distance > 1165):
            print("zahnbuerste entfernt!")
        else:
            print("zahnbuerste in becher!")



        #x_kalibriert=int(x_kalibriert)
        #y_kalibriert=int(y_kalibriert)

        status["y"] = y_kalibriert
        status["x"] = x_kalibriert
        print(json.dumps(status))  #rausschicken fuer matthias


        #print(time.time()-last_update)
        #last_update = time.time()
        #continue

        depth_colormap = cv2.applyColorMap(cv2.convertScaleAbs(t_image), cv2.COLORMAP_JET)

        # Stack both images horizontally
        # images = np.hstack((color_image, t_image))

        cv2.imshow("test", depth_colormap)
        # cv2.imshow("test", depth_image)
        cv2.waitKey(1)




finally:
    print("bilder verarbeitet")
    pipe.stop()