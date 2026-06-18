export interface CameraHandle {
  stream: MediaStream;
  stop: () => void;
}

export async function startCamera(): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  return { stream, stop: () => stream.getTracks().forEach(t => t.stop()) };
}
