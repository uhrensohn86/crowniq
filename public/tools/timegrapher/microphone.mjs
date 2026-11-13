// Labels are hints, not a hardware identity guarantee. Never infer from list order.
export function describeMicrophone(track, override = 'auto') {
  const label = (track?.label || '').trim().slice(0, 200);
  let kind = 'unknown';
  if (/\b(usb|tgbc)\b/i.test(label)) kind = 'usb';
  else if (/built[ -]?in|internal|integriert|internes|eingebaut/i.test(label)) kind = 'internal';
  const manual = ['internal', 'usb', 'unknown'].includes(override);
  return Object.freeze({
    microphone_type: manual ? override : kind,
    microphone_label: label || null,
    microphone_detection: manual ? 'manual' : kind === 'unknown' ? 'unknown' : 'label',
  });
}

export function microphoneConstraints(deviceId = '') {
  return {audio: {echoCancellation: false, noiseSuppression: false,
    autoGainControl: false, channelCount: 1,
    ...(deviceId ? {deviceId: {exact: deviceId}} : {})}, video: false};
}

export async function listMicrophones(mediaDevices) {
  if (!mediaDevices?.enumerateDevices) return [];
  const devices = await mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === 'audioinput' && device.deviceId);
}
