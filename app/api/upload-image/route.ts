import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { base64Data, fileName } = await request.json();

    if (!base64Data) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || 'private_hsCeuLWgJvTSjc02hpRiJfIvGSQ=';
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || 'public_UwlZUVKBoqWEAGMd0RqLJGFp6n4=';
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/peh3xvmh1';

    // Construct FormData for ImageKit REST API Upload
    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('fileName', fileName || `item_${Date.now()}.jpg`);
    formData.append('useUniqueFileName', 'true');

    // Basic authentication header: Base64(privateKey + ":")
    const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`;

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ImageKit API Upload error response:', errorText);
      return NextResponse.json({ error: `ImageKit upload failed: ${errorText}` }, { status: 500 });
    }

    const result = await response.json();

    // Return official ImageKit URL
    return NextResponse.json({
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    });
  } catch (error: any) {
    console.error('ImageKit Upload Endpoint error:', error);
    return NextResponse.json({ error: error?.message || 'Server upload error' }, { status: 500 });
  }
}
