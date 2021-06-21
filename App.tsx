import React, {useState, useRef} from 'react';
import {  StyleSheet, Text, View } from 'react-native';
import GettingCall from './components/GettingCall';
import Video from './components/Video';
import Button from './components/Button';
import { EventOnAddStream, MediaStream, RTCPeerConnection, RTCIceCandidate } from 'react-native-webrtc';
import Utils from './Utils';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

export default function App() {
  const [localStream, setLocalStream] = useState<MediaStream | null >();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null >();
  const [gettingCall, setGettingCall] = useState(false);
  const pc = useRef<RTCPeerConnection>();
  const connecting = useRef(false);

  const setupWebrtc = async () => {
    pc.current = new RTCPeerConnection(configuration);
    //Get the audio and videostream of call
    const stream = await Utils.getStream()
    if(stream){
      setLocalStream(stream);
      pc.current.addStream(stream);
    }

    //Get the remote stream once it available
    pc.current.onaddstream = (event: EventOnAddStream) =>{
      setRemoteStream(event.stream)
    }
  }


  const create = async () => {
    console.log("Calling");
    connecting.current = true;

    //set webRTC
    await setupWebrtc();

    //Document for the call
    const cRef = firestore().collection('meet').doc('chatId');


    //Exchange of ICE candidate betwen the caller and calle
    collectIceCandidates(cRef, "caller", "callee")

    if(pc.current){
      //Create offer for the call
      //store the offer under doc
      const offer = await pc.current.createOffer();
      pc.current.setLocalDescription(offer)

      const cWithOffer = {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        }
      }

      cRef.set(cWithOffer)
    }
  }
  const join = async () => {}
  const hangup = async () => {}

  //helper func
  const collectIceCandidates = async (
    cRef: FirebaseFirestoreTypes.DocumentReference<FirebaseFirestoreTypes.DocumentData >,
    localName: string,
    remoteName: string,
  ) => {
    const candidateCollection = cRef.collection(localName);

    if(pc.current){
      //on new ICE candidate add it to firestore
      pc.current.onicecandidate = (event) => {
        if(event.candidate){
          candidateCollection.add(event.candidate);
        }
      };
    }

    //Get the ICE candidate added to firestore and update local ICE
    cRef.collection(remoteName).onSnapshot(snapshot =>{
      snapshot.docChanges().forEach((change: any) => {
        if(change.type == 'added'){
          const candidate = new RTCIceCandidate(change.doc.data())
          pc.current?.addIceCandidate(candidate);
        }
      })
    }
    )
  }

  //Display the gettingCall Component
  if(gettingCall){
    return <GettingCall handup={hangup} join={join}/>
  }
  //Display the gettingCall Compoenent
  //Display both local and remote stream once call is connected
  if(localStream){
    return (
      <Video 
        hangup={hangup}
        localStream={localStream}
        remoteStream={remoteStream}
      />
    )
  }
  //Display the call button
  return (
    <View style={styles.container}>
      <Button iconName='video' backgroundColor='grey' onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
