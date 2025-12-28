import { fal } from "@fal-ai/client";

interface NanoBananaProInput {
  prompt: string;
  image_size?: {
    width: number;
    height: number;
  };
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
}


export async function generateImage(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_FAL_API_KEY;

  if (!apiKey) {
    throw new Error('FAL_API_KEY is not configured');
  }

  fal.config({
    credentials: apiKey,
  });

  const input: NanoBananaProInput = {
    prompt,
    image_size: {
      width: 2048,
      height: 2048,
    },
    num_inference_steps: 4,
    guidance_scale: 3.5,
    num_images: 1,
  };

  try {
    const result: any = await fal.subscribe("fal-ai/nano-banana-pro", {
      input,
      logs: true,
    });

    if (result.data?.images && result.data.images.length > 0) {
      return result.data.images[0].url;
    }

    throw new Error('No image generated');
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

export async function editImage(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_FAL_API_KEY;

  if (!apiKey) {
    throw new Error('FAL_API_KEY is not configured');
  }

  fal.config({
    credentials: apiKey,
  });

  const input: any = {
    image_url: imageUrl,
    prompt,
    image_size: {
      width: 2048,
      height: 2048,
    },
    num_inference_steps: 4,
    guidance_scale: 3.5,
  };

  try {
    const result: any = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input,
      logs: true,
    });

    if (result.data?.images && result.data.images.length > 0) {
      return result.data.images[0].url;
    }

    throw new Error('No image generated');
  } catch (error) {
    console.error('Error editing image:', error);
    throw error;
  }
}
