
// UI elements
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const statusArea = document.getElementById('statusArea');
const clearStatusButton = document.getElementById('clearStatusButton');
const audioInputDevies = document.getElementById('audioInputDevices');
const audioElement = document.getElementById('audioElement');
const sentStatsLabel = document.getElementById('sentStatsLabel');
const receivedStatsLabel = document.getElementById('receivedStatsLabel');

connectButton.onclick = connect;
disconnectButton.onclick = disconnect;
audioInputDevies.onchange = changeDevice;

clearStatusButton.onclick = () => {
  statusArea.innerHTML = ''
}

disconnectButton.disabled = true;

var pc1 = null;
var pc2 = null;
var sender1 = null;

var stream1 = null;

var stats = setInterval(() => {
  const pcOut = pc1;
  if (pcOut!= null) {
    pcOut.getStats().then(res => {
    res.forEach(report => {
      if (report.type === 'outbound-rtp') {
        sentStatsLabel.innerHTML = `Packets: ${report.packetsSent}, bytes: ${report.bytesSent}`;
      }
    });
    }).catch(error => {
      status(`Failed to get stats for PC1: ${error.toString()}\n`)
    });
  }
  const pcIn = pc2;
  if (pcIn!= null) {
    pcIn.getStats().then(res => {
    res.forEach(report => {
      if (report.type === 'inbound-rtp') {
        receivedStatsLabel.innerHTML = `Packets: ${report.packetsReceived}, bytes: ${report.bytesReceived}`;
      }
    });
    }).catch(error => {
      status(`Failed to get stats for PC1: ${error.toString()}\n`)
    });
  }

}, 1000);

const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 0,
  voiceActivityDetection: false
};

window.onload = function() {
  enumerateDevices();
}

function status(msg) {
   statusArea.innerHTML += msg;
   console.log(msg);
}

function enumerateDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    status('enumerateDevices() not supported.');
    return;
  }
  navigator.mediaDevices.enumerateDevices().then(devices => {
   const index = audioInputDevies.selectedIndex;
   for (let i = audioInputDevies.options.length - 1 ; i >= 0 ; i--) {
      audioInputDevies.remove(i);
    }
    devices.forEach(device => {
     if (device.kind === 'audioinput') {
        const option = document.createElement('option');
        option.text = device.label || device.deviceId;
        option.value = device.deviceId;
        audioInputDevices.add(option);
      }
    });
    audioInputDevies.selectedIndex = Math.max(0, Math.min(index, audioInputDevies.options.length - 1));
  }).catch(error => {
    status(`Error getting devices: ${error.toString()}\n`);
  });
}

function negotiate() {
  status('Negotiating\n');
  pc1.createOffer(offerOptions).then(offer => {
    status(`Create offer: ${offer.sdp}\n`);
    pc1.setLocalDescription(offer).then(() => {
      pc2.setRemoteDescription(offer).then(() => {
        pc2.createAnswer().then(answer => {
          status(`Create answer: ${answer.sdp}\n`);
          pc2.setLocalDescription(answer).then(() => {
            pc1.setRemoteDescription(answer).catch(error => {
              status(`Failed to set remote description to PC1: ${error.toString()}\n`);
            });
          }).catch(error => {
            status(`Failed to set local description to PC2: ${error.toString()}\n`);
          });
        }).catch(error => {
          status(`Failed to create answer: ${error.toString()}\n`);
        });
      }).catch(error => {
        status(`Failed to set remote description for PC2: ${error.toString()}\n`);
      });
    }).catch(error => {
      status(`Failed to set local description for PC1: ${error.toString()}\n`);
    });
  }).catch(error => {
    status(`Failed to create offer: ${error.toString()}\n`);
  });
} 

function connect() {
  const id = audioInputDevies.options[audioInputDevies.selectedIndex].value;
  const label = audioInputDevies.options[audioInputDevies.selectedIndex].text;
  status(`Using device: ${label}\n`);

  const constraints = {audio: {deviceId: id}};
  navigator.mediaDevices.getUserMedia(constraints).then(localStream => {
    stream1 = localStream;

    pc1 = new RTCPeerConnection();
    pc1.onicecandidate = (c) => {
      if (c.candidate != null) {
        status(`PC1 ice candidate: ${c.candidate.candidate}\n`);
      } else {
        status('PC1 null candidate\n');
      }
      pc2.addIceCandidate(c.candidate).catch(error => {
        status(`Error adding ice candidate to PC2: ${error.toString()}\n`);
      });
    };
    pc1.oniceconnectionstatechange = (e) => {
      status(`PC1 ice connection state: ${e.currentTarget.iceConnectionState}\n`);
      if (e.currentTarget.iceConnectionState === 'connected') {
        connectButton.disabled = true;
        disconnectButton.disabled = false;
      }
    };
    pc1.onnegotiationneeded = (e) => {
      negotiate();
    };
    localStream.getTracks().forEach(track => {
      sender1 = pc1.addTrack(track, localStream);
    });

    pc2 = new RTCPeerConnection();
    pc2.onicecandidate = (c) => {
      if (c.candidate != null) {
        status(`PC2 ice candidate: ${c.candidate.candidate}\n`);
      } else {
        status('PC2 null candidate\n');
      }
      pc1.addIceCandidate(c.candidate).catch(error => {
        status(`Error adding ice candidate to PC1: ${error.toString()}\n`);
      });
    };
    pc2.oniceconnectionstatechange = (e) => {
      status(`PC2 ice connection state: ${e.currentTarget.iceConnectionState}\n`);
    };
    pc2.ontrack = (t) => {
      status('PC2 track received\n');
      audioElement.srcObject = t.streams[0];
    }
  }).catch(error => {
    status(`getUserMedia error: ${error.toString()}\n`);
  });
}

function disconnect() {
  if (pc1 != null) {
    pc1.close();
    pc1 = null;
  }
  if (pc2 != null) {
    pc2.close();
    pc2 = null;
  }
  connectButton.disabled = false;
  disconnectButton.disabled = true;
}

function changeDevice() {
  if (pc1 == null) {
    return;
  }
  pc1.removeTrack(sender1);
  sender1 = null;
  if (stream1 != null) {
    stream1.getTracks().forEach(track => track.stop());
  }
  const id = audioInputDevies.options[audioInputDevies.selectedIndex].value;
  const label = audioInputDevies.options[audioInputDevies.selectedIndex].text;
  status(`Changing device: ${label}\n`);
  const constraints = {audio: {deviceId: id}};

  navigator.mediaDevices.getUserMedia(constraints).then(localStream => {
    status('getUserMedia success\n');
    stream1 = localStream;

    localStream.getTracks().forEach(track => {
      sender1 = pc1.addTrack(track, localStream);
    });
  }).catch(error => {
    status(`getUserMedia error: ${error.toString()}\n`);
  });
}
