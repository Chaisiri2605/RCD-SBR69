/**
 * Helper to compress image files client-side before sending to server.
 * Keeps JSON payload small and fast to transport.
 */
export function compressImage(file: File, maxWidth = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback if canvas context is not available
          resolve(event.target?.result as string);
          return;
        }

        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.75 quality for visual balance
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        resolve(compressedBase64);
      };
      img.onerror = (err) => {
        console.error("Image loading error:", err);
        reject(err);
      };
    };
    reader.onerror = (err) => {
      console.error("FileReader loading error:", err);
      reject(err);
    };
  });
}
