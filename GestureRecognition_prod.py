#!/usr/bin/env python3
import pyrealsense2 as rs
import numpy as np
import cv2
import json
import sys
import time

# Python dict object
status = {
    "x":  0, # 0 <= x <= 1920
    "y": 0, # 0 <= y <= 1080
    "visible": True,
    "startTimer": False
}

#referenz 3d punkte von Fernsehecken

oben_links = np.array([0.41, 0.19, 0.57])
unten_links = np.array([0.42, 0.35, 0.96])
oben_rechts = np.array([-0.37, 0.18, 0.55])
#unten_rechts = np.array([-0.37, 0.23, 1.02])#nicht benötigt

x_kalib_faktor = 1920 / (oben_links.item(0)-oben_rechts.item(0))
y_kalib_faktor = 1080 / (unten_links.item(2) - oben_links.item(2))


#main
while (True):
    try:
        pipe = rs.pipeline()
        config = rs.config()

        config.enable_stream(rs.stream.depth, 640, 480, rs.format.z16, 30)

    # Start streaming
        pipe_profil = pipe.start(config)
        break
    except:
        Error_Kamera = "Die Kamera ist nicht angeschlossen. Bitte Kamera aus, ein stecken!"
        print(json.dumps(Error_Kamera), file=sys.stderr)


last_update = time.time()

x_list = []
y_list = []
Filter_array_x = []
Filter_array_y = []


zyklus_counter = 0
zyklus_endwert = 15
Zahn_array = []
zahnbuerste_vorhanden = 0
zahnbuerste_entfernt = 0
counter_zahnbuerste_entfernt = 0

try:

    while(True):


        # Wait for a coherent pair of frames: depth and color
      
        frames = pipe.wait_for_frames()
        depth_frame = frames.get_depth_frame()
        

        if not depth_frame:
            continue

        # Intrinsics & Extrinsics
        depth_intrin = depth_frame.profile.as_video_stream_profile().intrinsics

        # Depth scale - units of the values inside a de
        # pth frame, i.e how to convert the value to units of 1 meter
        depth_sensor = pipe_profil.get_device().first_depth_sensor()
        depth_scale = depth_sensor.get_depth_scale()  #



        #speichern als numpy image
        depth_image = np.asanyarray(depth_frame.get_data())
        #t_image = np.asanyarray(depth_frame.get_data())  # erzeugen eines images gleicher groesse wie depth_image
        array_min = np.asanyarray(depth_frame.get_data())

        array_min = array_min + 9999    #Zahnputzerekennung
        #t_image = t_image * 0 #nur für visualisieerung
        xArray = []
        yArray = []

        for y in range(360, 405):  # y  405 bildschirm 350 weg von bildschirm
            for x in range(50, 600):  # x
                if depth_image.item(y, x) > 525 and depth_image.item(y,x) < 980:  # 560 oberkannte fernseh, 1000 unterkannte fernseh

                    #t_image.itemset((y, x), 255)  # für visualisierung
                    yArray.append(y)  # fügt element hinzu für mittelwert bildung
                    xArray.append(x)



        # errechnen des Mittelpunktes
        if len(xArray) > 0 and len(yArray) > 0:
            meanX = np.mean(np.array(xArray))
            meanY = np.mean(np.array(yArray))

            meanX = int(meanX)
            meanY = int(meanY)


            #markieren des mittelpunktes
            #for y in range(meanY - 5, meanY + 5):
                #for x in range(meanX - 5, meanX + 5):
                    #t_image[y, x] = 100

            #3d koordinaten berechnen
            depth_pixel = [meanX, meanY]
            depth = depth_frame.get_distance(meanX, meanY)

            depth_point = rs.rs2_deproject_pixel_to_point(depth_intrin, depth_pixel, depth)
            #print(depth_point)

            # ermitteln der x,y koordinaten auf Monitor; 0-Punkt links oben am Fernseher
            x_monitor = oben_links.item(0) - depth_point[0]
            y_monitor = depth_point[2] - oben_links.item(2)
            status["visible"] = True


        else:
            x_monitor = 0
            y_monitor = 0
            status["visible"] = False



        # skalieren der 3d punkte auf bildschirmgroesse 1920x1080
        x_kalibriert = x_monitor * x_kalib_faktor  # 2493.5
        y_kalibriert = y_monitor * y_kalib_faktor  # 2571.4

        #print(x_kalibriert)
        #print(y_kalibriert)

         #messwerte sammeln und mitteln
        Filter_array_x.append(x_kalibriert)
        Filter_array_y.append(y_kalibriert)

        if(len(Filter_array_y)>4):
            Filter_array_y.pop(0)
        if(len(Filter_array_x)>4):
            Filter_array_x.pop(0)

        mean_kalibriert_x = np.mean(np.array(Filter_array_x))
        mean_kalibriert_y = np.mean(np.array(Filter_array_y))



        # Zahnputzerkennnung
        for y in range(360, 410):  # y  420 bildschirm 370 weg von bildschirm
            for x in range(410, 490):  # x
                if depth_image.item(y, x) > 1080 and depth_image.item(y, x) < 1200:
                    array_min.itemset((y, x), depth_image.item(y, x))

                else:
                    array_min.itemset((y, x), 9999)

        min_distance = (np.min(array_min))  # verarbeitung zahnbuerste
        # print(min_distance)

        if (zyklus_counter != zyklus_endwert):

            if (min_distance > 1100):
                text = "zahnbuerste entfernt"
            else:
                text = "zahnbuerste in becher"

            Zahn_array.append(text)
            zyklus_counter = zyklus_counter + 1

        else:
            for i in range(0, zyklus_endwert):
                if (Zahn_array[i] == "zahnbuerste entfernt"):
                    zahnbuerste_entfernt = zahnbuerste_entfernt + 1

                if (Zahn_array[i] == "zahnbuerste in becher"):
                    zahnbuerste_vorhanden = zahnbuerste_vorhanden + 1

            if (zahnbuerste_entfernt > zahnbuerste_vorhanden):
                counter_zahnbuerste_entfernt = counter_zahnbuerste_entfernt + 1
                if (counter_zahnbuerste_entfernt == 20):
                    #print("startTimer=true")
                    status["startTimer"] = True
                    counter_zahnbuerste_entfernt = 0

            else:
                #print("startTimer=false")
                status["startTimer"] = False

            zyklus_counter = 0
            zahnbuerste_vorhanden = 0
            zahnbuerste_entfernt = 0
            Zahn_array.clear()



        #x_kalibriert=int(x_kalibriert)
        #y_kalibriert=int(y_kalibriert)

        status["y"] = mean_kalibriert_y
        status["x"] = mean_kalibriert_x
        print(json.dumps(status))  #rausschicken fuer matthias


        #print(time.time()-last_update)
        #last_update = time.time()
        #continue

        #depth_colormap = cv2.applyColorMap(cv2.convertScaleAbs(t_image), cv2.COLORMAP_JET)


        #cv2.imshow("test", depth_colormap)
        #cv2.waitKey(1)




finally:
    pipe.stop()
