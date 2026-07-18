/**
 * Compress an image file using HTML5 Canvas to under 60KB (61,440 bytes)
 * without sacrificing visual quality.
 */
export async function compressImageTo60KB(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const targetSizeBytes = 60 * 1024; // 60 KB
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale maximum dimension to 600px max for high quality + low size
        const maxDimension = 600;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative compression algorithm to guarantee size <= 60KB
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let sizeInBytes = Math.round((dataUrl.length - 22) * 3 / 4);

        while (sizeInBytes > targetSizeBytes && quality > 0.15) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeInBytes = Math.round((dataUrl.length - 22) * 3 / 4);
        }

        // If still > 60KB, downscale canvas dimensions and retry
        if (sizeInBytes > targetSizeBytes) {
          canvas.width = Math.round(width * 0.7);
          canvas.height = Math.round(height * 0.7);
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }

        resolve(dataUrl);
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Upload compressed image data to ImageKit API endpoint and return official ImageKit CDN URL.
 */
export async function uploadToImageKit(base64Data: string, fileName: string): Promise<string> {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Data,
      fileName,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json();
    throw new Error(errorJson.error || 'Failed to upload image to ImageKit');
  }

  const result = await response.json();
  if (!result.url) {
    throw new Error('ImageKit response did not return a valid URL');
  }

  // Return official ImageKit URL
  return result.url;
}
