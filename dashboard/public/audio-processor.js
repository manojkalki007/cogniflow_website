class AudioSendProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0];
    if (input) {
      this.port.postMessage(input);
    }
    return true;
  }
}
registerProcessor('audio-send-processor', AudioSendProcessor);
