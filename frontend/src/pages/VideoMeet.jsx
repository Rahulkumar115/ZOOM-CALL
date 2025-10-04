import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Container, Box, Stack } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';

const server_url = process.env.REACT_APP_API_URL;

var connections = {};

const peerConfigConnections = {
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ]
};

// Add this helper component before your main component
const VideoTile = ({ participant, onClick }) => {
    const videoRef = useRef();

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <div className={styles.videoTile} onClick={() => onClick(participant)} onTouchEnd={() => onClick(participant)}>
            <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
            <div className={styles.participantName}>
                {participant.name} {participant.isLocal && '(You)'}
            </div>
        </div>
    );
};

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(false);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    const [pinnedSocketId, setPinnedSocketId] = useState(null);

    // TODO
    // if(isChrome() === false) {


    // }

    const [peerConfigConnections, setPeerConfigConnections] = useState({ iceServers: [] });

    useEffect(() => {
        fetchIceServers();
        getPermissions();
    }, []);

    const fetchIceServers = async () => {
        try {
            const response = await fetch(`${server_url}/api/ice-servers`);
            const iceServers = await response.json();
            if (iceServers.length > 0) {
                setPeerConfigConnections({ iceServers });
            } else {
                setPeerConfigConnections({
                    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
                });
            }
        } catch (error) {
            console.error('Failed to fetch ICE servers:', error);
            setPeerConfigConnections({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });
        }
    };

    const handlePin = (participant) => {
    if (pinnedSocketId === participant.socketId) {
        setPinnedSocketId(null); // Unpin if clicking the same person
    } else {
        setPinnedSocketId(participant.socketId); // Pin the new person
    }
};

// ADD THIS NEW BLOCK OF CODE

// This helper function tells every connected peer to display the new video track
const replaceTrack = (stream) => {
    // Update your local video preview
    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    // Get the new video track
    const newVideoTrack = stream.getVideoTracks()[0];

    // Go through all active connections and replace the video track
    for (let peerId in connections) {
        const sender = connections[peerId].getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(newVideoTrack);
        }
    }
};

const handleScreen = () => {
    if (!screen) { // If screen share is OFF, we want to turn it ON
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then(screenStream => {
                setScreen(true);
                replaceTrack(screenStream);

                // Add a listener for when the user clicks the browser's "Stop sharing" button
                screenStream.getVideoTracks()[0].onended = () => {
                    setScreen(false);
                    // When they stop, switch back to their camera
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(cameraStream => {
                            replaceTrack(cameraStream);
                        });
                };
            })
            .catch(e => console.log("Error getting display media:", e));
    } else { // If screen share is ON, we want to turn it OFF
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(cameraStream => {
                setScreen(false);
                replaceTrack(cameraStream);
            });
    }
};

    

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);

        }


    }, [video, audio])
    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }




    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false })

    socketRef.current.on('signal', gotMessageFromServer)

    socketRef.current.on('connect', () => {
        socketRef.current.emit('join-call', window.location.href)
        socketIdRef.current = socketRef.current.id

        socketRef.current.on('chat-message', addMessage)

        socketRef.current.on('user-left', (id) => {
            setVideos((videos) => videos.filter((video) => video.socketId !== id))
            // Also close and remove the connection object
            if (connections[id]) {
                connections[id].close();
                delete connections[id];
            }
        })

        socketRef.current.on('user-joined', (id, clients) => {
            clients.forEach((socketListId) => {
                // Don't create a connection for yourself
                if (socketListId === socketIdRef.current) return;
                
                // Create a new peer connection
                connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                // Wait for their ice candidate       
                connections[socketListId].onicecandidate = function (event) {
                    if (event.candidate != null) {
                        socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                    }
                }

                // Wait for their media tracks
                connections[socketListId].ontrack = (event) => {
                    const remoteStream = event.streams[0];
                    setVideos(prevVideos => {
                        if (prevVideos.find(video => video.socketId === socketListId)) {
                            return prevVideos;
                        }
                        return [...prevVideos, { socketId: socketListId, stream: remoteStream }];
                    });
                };

                // Add your local media tracks to the connection
                if (window.localStream) {
                    window.localStream.getTracks().forEach(track => {
                        connections[socketListId].addTrack(track, window.localStream);
                    });
                }
            })

            // If you are the new user who just joined, create offers for everyone else
            if (id === socketIdRef.current) {
                for (let id2 in connections) {
                    if (id2 === socketIdRef.current) continue;

                    connections[id2].createOffer().then((description) => {
                        connections[id2].setLocalDescription(description)
                            .then(() => {
                                socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                            })
                            .catch(e => console.log(e))
                    })
                }
            }
        })
    })
}

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }

    
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }


    return (
    <div>
        {askForUsername === true ? (
            // --- IMPROVED LOBBY UI ---
            <div className={styles.lobbyContainer}>
                <h2>Enter into Lobby</h2>
                <video ref={localVideoref} autoPlay muted className={styles.lobbyVideoPreview}></video>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                    <Button variant="contained" onClick={connect} disabled={!username}>Connect</Button>
                </Stack>
            </div>
        ) : (
            // --- NEW ZOOM-LIKE LAYOUT ---
            <div className={styles.meetContainer}>
                <div className={showModal ? styles.mainContentWithChat : ""}>
                    {(() => {
                        // This creates a temporary array for rendering without changing your state logic
                        const allParticipants = [
                            { socketId: 'local', stream: window.localStream, name: username, isLocal: true },
                            ...videos.map(v => ({...v, name: `User-${v.socketId.substring(0,4)}`}))
                        ];
                        const pinnedParticipant = allParticipants.find(p => p.socketId === pinnedSocketId);
                        const otherParticipants = allParticipants.filter(p => p.socketId !== pinnedSocketId);

                        return pinnedSocketId ? (
                            // SPEAKER VIEW (if someone is pinned)
                            <div className={styles.speakerView}>
                                <div className={styles.mainVideo}><VideoTile participant={pinnedParticipant} onClick={handlePin} /></div>
                                <div className={styles.filmStrip}>{otherParticipants.map(p => <VideoTile key={p.socketId} participant={p} onClick={handlePin} />)}</div>
                            </div>
                        ) : (
                            // GALLERY VIEW (default)
                            <div className={styles.galleryView}>{allParticipants.map(p => <VideoTile key={p.socketId} participant={p} onClick={handlePin} />)}</div>
                        );
                    })()}
                </div>

                {showModal && (
                    <div className={styles.chatRoom}>
                        <div className={styles.chatContainer}>
                            <h3>Chat</h3>
                            <div className={styles.chattingDisplay}>
                                {messages.length > 0 ? messages.map((item, index) => (
                                    <div key={index} className={item.sender === username ? styles.myMessage : styles.otherMessage}>
                                        <p style={{ fontWeight: "bold", margin: 0 }}>{item.sender === username ? 'You': item.sender}</p>
                                        <p style={{ margin: 0 }}>{item.data}</p>
                                    </div>
                                )) : <p>No messages yet.</p>}
                            </div>
                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} label="Message" variant="outlined" size="small" fullWidth />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className={styles.buttonContainers}>
                    <IconButton onClick={handleVideo} style={{ color: "white" }}>{(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
                    <IconButton onClick={handleEndCall} style={{ color: "red" }}> <CallEndIcon /> </IconButton>
                    <IconButton onClick={handleAudio} style={{ color: "white" }}>{audio === true ? <MicIcon /> : <MicOffIcon />}</IconButton>
                    {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton> : <></>}
                    <Badge badgeContent={newMessages} color="primary">
                        <IconButton onClick={() => { setModal(!showModal); if (!showModal) setNewMessages(0); }} style={{ color: "white" }}>
                            <ChatIcon />
                        </IconButton>
                    </Badge>
                </div>
            </div>
        )}
    </div>
);
}