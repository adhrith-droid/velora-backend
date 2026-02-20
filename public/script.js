const socket = io();

const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');

let localStream;
let peerConnection;
let partnerId = null;

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

startBtn.onclick = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        startOverlay.style.display = 'none';
        nextBtn.style.display = 'block';
        findPartner();
    } catch (err) {
        console.error('Error accessing media devices:', err);
        alert('Camera and Microphone are required to use this app.');
    }
};

nextBtn.onclick = () => {
    resetConnection();
    findPartner();
};

function findPartner() {
    statusDiv.innerText = 'Searching for stranger...';
    statusDiv.style.display = 'block';
    remoteVideo.srcObject = null;
    socket.emit('find-partner');
}

function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    partnerId = null;
    remoteVideo.srcObject = null;
}

socket.on('waiting', () => {
    statusDiv.innerText = 'Waiting for stranger...';
});

socket.on('match-found', async (data) => {
    partnerId = data.partnerId;
    statusDiv.style.display = 'none';
    
    createPeerConnection();

    if (data.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { signal: offer });
    }
});

socket.on('signal', async (data) => {
    if (!peerConnection) createPeerConnection();

    if (data.signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { signal: answer });
    } else if (data.signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signal.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
        } catch (e) {
            console.error('Error adding ice candidate', e);
        }
    }
});

socket.on('partner-disconnected', () => {
    resetConnection();
    findPartner();
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { signal: event.candidate });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'closed') {
            resetConnection();
            findPartner();
        }
    };
}
