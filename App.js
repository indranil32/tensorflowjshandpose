import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Platform, Image, Button } from 'react-native';
import * as Permissions from 'expo-permissions';
import { Camera, Constants } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import * as fp from 'fingerpose';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
//import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-react-native';
//import '@tensorflow/tfjs-backend-webgl';


//disable yellow warnings on EXPO client!
//console.disableYellowBox = true;
//YellowBox.ignoreWarnings(['Warning: isMounted(...) is deprecated', 'Module RCTImageLoader', 'RNDeviceInfo',   'Warning: An update']);
//LogBox.ignoreWarnings = true;

export default function App() {
  //RAF ID
  let requestAnimationFrameId = 0;
  const [tfReady, setTfReady] = useState(false);
  const [hpmReady, setHpmReady] = useState(false);
  const [handposeModel, setHandposeModel] = useState(null);
  //performance hacks (Platform dependent)
  const textureDims =
    Platform.OS === 'ios'
      ? { width: 1080, height: 1920 }
      : { width: 1600, height: 1200 };
  const tensorDims = { width: 152, height: 200 };
  const [emoji, setEmoji] = useState(null);
  //TF Camera Decorator
  const TensorCamera = cameraWithTensors(Camera);

  useEffect(() => {
    const init = async () => {
      if (!hpmReady && !tfReady) {
        console.log("Initializing...");
        tf.device_util.isMobile = () => true;
        tf.device_util.isBrowser = () => false;
        tf.ready()
          .then(() => {
            setTfReady(true);
            console.log(tf.getBackend());
            handpose.load()
              .then(model => {
                console.log("hand pose model: ", model)
                setHandposeModel(model)
                setHpmReady(true)
                console.log("Tf and handpose model initialized");
              })
              .catch(e2 => {
                console.error("Hand pose model load error", e2.message, e2.stack);
              })                
          })
          .catch(e1 => {
            console.error("TF init error", e1.message, e1.stack);
          })        
      }
    }
    init();
  },[])

  useEffect(() => {
    return () => {
      console.log("Cancelling animation frame: ", requestAnimationFrameId);
      cancelAnimationFrame(requestAnimationFrameId);
    };
  }, [requestAnimationFrameId]);


  function handleCameraStreamV2(images, updatePreview, gl) {
    const loop = async () => {
      if (tfReady && hpmReady && handposeModel){
        const nextImageTensor = images.next().value
        console.log("imageAsTensors: ", JSON.stringify(nextImageTensor))
        if (nextImageTensor){
          console.log("Calling estimateHands...")
          handposeModel.estimateHands(nextImageTensor)
            .then(prediction => {
              console.log("prediction: ", JSON.stringify(prediction));
              setEmoji(null);
              if (prediction && prediction.length > 0) { 
                const GE = new fp.GestureEstimator([fp.Gestures.ThumbsUpGesture]);
                const gesture = GE.estimate(prediction[0].landmarks, 7.5);
                console.log("Gesture: ", gesture);
                if (gesture.gestures !== undefined && gesture.gestures.length > 0) {  
                  const confidence = gesture.gestures.map(
                    (prediction) => prediction.confidence
                  );
                  const mxConfidence = confidence.indexOf(
                    Math.max.apply(null, confidence)
                  );
                  const emojiName = gesture.gestures[mxConfidence].name;
                  console.log("emoji name: ", emojiName)
                  setEmoji(emojiName);
                }
              }
              console.log('Looping...')
              requestAnimationFrameId = requestAnimationFrame(loop);            
            })
            .catch(e1 => {
              console.error("Prediction error", e1.message, e1.stack);
            })
        }                
      }      
    }
    loop();
  }
  
  return (
    <View style={styles.container}>
      {hpmReady && tfReady ? 
        (<TensorCamera
            style={styles.camera}
            type={Camera.Constants.Type.back}
            zoom={0}
            cameraTextureHeight={textureDims.height}
            cameraTextureWidth={textureDims.width}
            resizeHeight={tensorDims.height}
            resizeWidth={tensorDims.width}
            resizeDepth={3}
            onReady={handleCameraStreamV2}
            autorender={true}
          />
        ) : (<Text style={styles.camera}>{"Initializing..."}</Text>)}
        {emoji !== null ? (
          <Image
            style={styles.tinyLogo}
            source={require('./assets/thumbs_up.png')}
          />
        ) : (
          <Text>{""}</Text>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
  },
  camera: {
    position: 'absolute',
    left: 90,
    top: 100,
    width: 500 / 2,
    height: 800 / 2,
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 0,
  },
  tinyLogo: {
    width: 50,
    height: 50,
  }
});
