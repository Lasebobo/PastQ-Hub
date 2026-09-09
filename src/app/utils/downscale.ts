/**
 * Shrinks an image before it is sent to /api/ocr.
 *
 * Vercel Serverless Functions reject request bodies over 4.5 MB, and base64 inflates
 * a file by roughly a third — so a 3.4 MB phone photo already exceeds the cap. Most
 * exam-paper photos are larger than that, which would make OCR fail in production
 * while working fine locally, where the dev server has no such limit.
 *
 * Downscaling also helps the OCR itself: Gemini gains nothing from a 12-megapixel
 * image of a page, and a smaller upload is a faster round trip.
 *
 * PDFs are passed through untouched — they cannot be drawn to a canvas, and a PDF of
 * a page is usually well under the cap anyway.
 */

/** Longest edge, in pixels, after downscaling. Ample for reading printed text. */
const MAX_EDGE = 2200;

/** Stay under Vercel's 4.5 MB cap with room for the JSON envelope. */
const MAX_BASE64_BYTES = 4.0 * 1024 * 1024;

/** Quality steps tried in order until the encoded result fits. */
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

export interface EncodedImage {
  /** Raw base64, with no `data:` prefix — the shape Gemini's inlineData wants. */
  base64: string;
  mimeType: string;
  /** True when the image was re-encoded rather than passed through as-is. */
  downscaled: boolean;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string, fallbackType: string) {
  const [meta, base64] = dataUrl.split(",");
  return {
    base64: base64 ?? "",
    mimeType: meta?.match(/^data:([^;]+)/)?.[1] || fallbackType || "image/jpeg",
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = dataUrl;
  });
}

/**
 * Returns base64 suitable for /api/ocr, downscaled and re-encoded when needed.
 * Falls back to the original bytes if anything in the canvas path fails, so a
 * browser quirk degrades to the old behaviour rather than blocking the upload.
 */
export async function encodeImageForOcr(file: File): Promise<EncodedImage> {
  const dataUrl = await readAsDataUrl(file);
  const original = splitDataUrl(dataUrl, file.type);

  // PDFs and anything non-image: send as-is.
  if (!file.type.startsWith("image/")) {
    return { ...original, downscaled: false };
  }

  // Already comfortably small: don't re-encode and lose fidelity for nothing.
  if (original.base64.length <= MAX_BASE64_BYTES) {
    return { ...original, downscaled: false };
  }

  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return { ...original, downscaled: false };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      const { base64 } = splitDataUrl(encoded, "image/jpeg");
      if (base64.length <= MAX_BASE64_BYTES) {
        return { base64, mimeType: "image/jpeg", downscaled: true };
      }
    }

    // Even the lowest quality is too big — send it and let the server say 413,
    // which is a clearer message than a silent failure here.
    const encoded = canvas.toDataURL("image/jpeg", QUALITY_STEPS[QUALITY_STEPS.length - 1]);
    const { base64 } = splitDataUrl(encoded, "image/jpeg");
    return { base64, mimeType: "image/jpeg", downscaled: true };
  } catch {
    return { ...original, downscaled: false };
  }
}
