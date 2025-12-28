export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      required: string[]
      properties: Record<string, any>
    }
  }
}

export const getWeather = (city: string): { weather: string; temperature: number; city: string } => {
  const weatherConditions = ['Sunny', 'Cloudy', 'Rainy', 'Snowy', 'Windy']
  const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)]
  const randomTemp = Math.floor(Math.random() * 30) + 5

  return {
    weather: randomWeather,
    temperature: randomTemp,
    city
  }
}

export const createSlides = async (
  topic: string,
  slideCount: number,
  conversationId: string,
  presentationId?: string
): Promise<{ presentation_id: string; slides: Array<{ id: string; title: string; content: any; slide_order: number }> }> => {
  const { supabase } = await import('./supabase');

  let presId: string = presentationId || '';

  if (!presId) {
    const { data: presentation, error: presError } = await supabase
      .from('presentations')
      .insert({
        conversation_id: conversationId,
        title: `${topic} Presentation`,
      })
      .select()
      .single();

    if (presError) throw presError;
    presId = presentation?.id || '';
  }

  const slides = [];
  for (let i = 0; i < Math.min(slideCount, 15); i++) {
    const slideData = {
      presentation_id: presId,
      slide_order: i,
      title: i === 0 ? topic : `${topic} - Key Point ${i}`,
      content: {
        bullets: i === 0 ? [] : [
          `Important insight ${i}.1`,
          `Key finding ${i}.2`,
          `Critical consideration ${i}.3`
        ],
        text: i === 0 ? `A comprehensive presentation about ${topic}` : ''
      },
      layout_type: i === 0 ? 'title-slide' : 'title-content',
      image_url: ''
    };

    const { data: slide, error } = await supabase
      .from('slides')
      .insert(slideData)
      .select()
      .single();

    if (error) throw error;
    slides.push(slide);
  }

  return { presentation_id: presId, slides };
}

export const generateSlideImage = async (prompt: string, slideId?: string): Promise<{ imageUrl: string; prompt: string }> => {
  const { generateImage } = await import('./fal');

  try {
    const imageUrl = await generateImage(prompt);

    if (slideId) {
      const { supabase } = await import('./supabase');
      await supabase
        .from('slides')
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', slideId);
    }

    return {
      imageUrl,
      prompt
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      imageUrl: 'https://images.pexels.com/photos/933054/pexels-photo-933054.jpeg?auto=compress&cs=tinysrgb&w=2048',
      prompt
    };
  }
}

export const searchWeb = (query: string): { results: Array<{ title: string; url: string; snippet: string }> } => {
  return {
    results: [
      {
        title: `${query} - Overview`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Comprehensive information about ${query}. Learn more about the latest developments and insights.`
      },
      {
        title: `Understanding ${query}`,
        url: `https://example.com/guide/${encodeURIComponent(query)}`,
        snippet: `A detailed guide covering everything you need to know about ${query}.`
      },
      {
        title: `${query} Best Practices`,
        url: `https://example.com/best-practices/${encodeURIComponent(query)}`,
        snippet: `Industry-standard best practices and recommendations for ${query}.`
      }
    ]
  }
}

export const tools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Retrieve current weather information for a city. Use this when the user asks about weather conditions.',
      parameters: {
        type: 'object',
        required: ['city'],
        properties: {
          city: {
            type: 'string',
            description: 'Name of the city to get weather for'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_slides',
      description: 'Generate presentation slides on a given topic. Use this when the user wants to create a presentation or slides. This will create slides in the database.',
      parameters: {
        type: 'object',
        required: ['topic', 'slide_count', 'conversation_id'],
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or subject for the slides'
          },
          slide_count: {
            type: 'number',
            description: 'Number of slides to generate (max 15)'
          },
          conversation_id: {
            type: 'string',
            description: 'ID of the current conversation'
          },
          presentation_id: {
            type: 'string',
            description: 'Optional ID of existing presentation to add slides to'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_slide_image',
      description: 'Generate a 2K resolution image for a slide using AI (Nano Banana Pro). Use this when creating visual content for presentations.',
      parameters: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Description of the image to generate for the slide'
          },
          slide_id: {
            type: 'string',
            description: 'Optional ID of the slide to attach the image to'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for information on a topic. Use this when the user needs current information or research.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query or topic to research'
          }
        }
      }
    }
  }
]

export const toolMap: Record<string, (args: any) => any> = {
  get_weather: (args: { city: string }) => getWeather(args.city),
  create_slides: (args: { topic: string; slide_count: number; conversation_id: string; presentation_id?: string }) =>
    createSlides(args.topic, args.slide_count, args.conversation_id, args.presentation_id),
  generate_slide_image: (args: { prompt: string; slide_id?: string }) =>
    generateSlideImage(args.prompt, args.slide_id),
  search_web: (args: { query: string }) => searchWeb(args.query)
}
