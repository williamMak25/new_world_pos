"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatOneDReader, HTMLCanvasElementLuminanceSource } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";

// Product barcodes are always 1D (UPC/EAN/Code128/etc.), never QR/Aztec/
// DataMatrix/PDF417/MaxiCode, so scan for 1D formats only via the library's
// dedicated one-dimensional reader instead of BrowserMultiFormatReader.
// This also sidesteps a chatty MultiFormatReader.decodeInternal() code path
// that logs a console.warn for basically every frame that doesn't contain
// a match for one of the many formats it tries — noisy but harmless, and
// avoided entirely by not going through it.
//
// TRY_HARDER trades some CPU for a much higher hit rate on barcodes that
// aren't perfectly flat, aligned, or lit — without it, a lot of real-world
// phone/webcam scans just silently never decode.
const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);

// Workaround for a bug in @zxing/browser@0.2.1 (the latest published
// version): HTMLCanvasElementLuminanceSource only lazily creates its temp
// canvas when `tempCanvasElement === null`, but the field is never
// initialized (it's `undefined`, not `null`), so that branch never runs and
// every rotate() call throws "Could not create a Canvas element." That
// silently breaks TRY_HARDER's rotated-barcode retry (OneDReader) for every
// 1D scan — i.e. basically all UPC/EAN/Code128 product barcodes — since
// OneDReader only attempts the rotation fallback when TRY_HARDER is on.
// zxing catches the throw and logs a warning rather than crashing, but the
// retry never actually succeeds. Patching the lazy-init check so it also
// covers `undefined`; safe to delete once upstream ships a fix
// (github.com/zxing-js/browser).
type LuminanceSourceInternals = { canvas: HTMLCanvasElement; tempCanvasElement?: HTMLCanvasElement | null };
(HTMLCanvasElementLuminanceSource.prototype as unknown as { getTempCanvasElement: () => HTMLCanvasElement }).getTempCanvasElement =
  function (this: LuminanceSourceInternals) {
    if (!this.tempCanvasElement) {
      const el = this.canvas.ownerDocument.createElement("canvas");
      el.width = this.canvas.width;
      el.height = this.canvas.height;
      this.tempCanvasElement = el;
    }
    return this.tempCanvasElement;
  };

export function BarcodeScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Requesting camera access…");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // Bumped to force the effect below to re-run and swap cameras when the
  // user picks a different one from the dropdown.
  const [requestedDeviceId, setRequestedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Managing getUserMedia ourselves (instead of via the library's
    // decodeFromVideoDevice) so we control exactly when the stream is
    // requested/released and can tell apart "permission denied" from
    // "camera opened but never started playing" from "scanning but nothing
    // found yet" — and so cleanup can bail out immediately (before ever
    // touching the <video>) if this effect run was already cancelled, which
    // React StrictMode's dev-mode double-invoke otherwise turns into two
    // overlapping camera streams racing on one element.
    let cancelled = false;
    let stream: MediaStream | null = null;
    let controls: { stop: () => void } | null = null;

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            ...(requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : { facingMode: { ideal: "environment" } }),
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (!cancelled) setError(`Unable to access camera: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices.filter((d) => d.kind === "videoinput"));
      } catch {
      }
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null);

      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      try {
        await video.play();
      } catch (err) {
        if (!cancelled) setError(`Unable to start camera preview: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (cancelled) return;
      const trackLabel = stream.getVideoTracks()[0]?.label || "camera";
      setStatus(`Scanning (${trackLabel}, ${video.videoWidth}×${video.videoHeight})…`);

      let detected = false;
      controls = await new BrowserMultiFormatOneDReader(hints).decodeFromVideoElement(video, (result) => {
        if (result && !detected) {
          detected = true;
          controls?.stop();
          onDetected(result.getText());
        }
      });
    }

    void start();

    return () => {
      cancelled = true;
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected, requestedDeviceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Scan barcode</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            {/* No autoPlay: the effect above already calls video.play() once
                the stream is attached, and having both trips a "trying to
                play video that is already playing" console warning. */}
            <video ref={videoRef} className="aspect-square w-full rounded-md bg-gray-900 object-cover" muted playsInline />
            <p className="mt-2 text-xs text-gray-400">{status}</p>
            {devices.length > 1 && (
              <select
                value={deviceId ?? ""}
                onChange={(e) => setRequestedDeviceId(e.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <p className="mt-3 text-xs text-gray-500">Point the camera at a barcode. It will be captured automatically.</p>
      </div>
    </div>
  );
}
