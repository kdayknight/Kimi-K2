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

export const createSlides = (topic: string, slideCount: number): { slides: Array<{ title: string; content: string }> } => {
  const slides = []
  for (let i = 1; i <= Math.min(slideCount, 10); i++) {
    slides.push({
      title: `${topic} - Slide ${i}`,
      content: `This is the content for slide ${i} about ${topic}. It includes key points and information relevant to the topic.`
    })
  }

  return { slides }
}

export const generateImage = (prompt: string, style?: string): { imageUrl: string; prompt: string; style: string } => {
  const styles = ['realistic', 'artistic', 'cartoon', 'abstract']
  const selectedStyle = style || styles[Math.floor(Math.random() * styles.length)]

  return {
    imageUrl: `https://images.pexels.com/photos/933054/pexels-photo-933054.jpeg?auto=compress&cs=tinysrgb&w=800`,
    prompt,
    style: selectedStyle
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
      description: 'Generate presentation slides on a given topic. Use this when the user wants to create a presentation or slides.',
      parameters: {
        type: 'object',
        required: ['topic', 'slide_count'],
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or subject for the slides'
          },
          slide_count: {
            type: 'number',
            description: 'Number of slides to generate (max 10)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate or find an image based on a text description. Use this when the user wants to create or see an image.',
      parameters: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Description of the image to generate'
          },
          style: {
            type: 'string',
            description: 'Style of the image (realistic, artistic, cartoon, abstract)'
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
  create_slides: (args: { topic: string; slide_count: number }) => createSlides(args.topic, args.slide_count),
  generate_image: (args: { prompt: string; style?: string }) => generateImage(args.prompt, args.style),
  search_web: (args: { query: string }) => searchWeb(args.query)
}
