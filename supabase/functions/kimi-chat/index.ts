const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface ChatRequest {
  model: string
  messages: any[]
  temperature?: number
  tools?: any[]
  tool_choice?: string
  stream?: boolean
  use_search?: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const kimiApiKey = Deno.env.get('KIMI_API_KEY')
    const kimiBaseUrl = Deno.env.get('KIMI_BASE_URL') || 'https://api.moonshot.ai/v1'

    if (!kimiApiKey) {
      return new Response(
        JSON.stringify({ error: 'KIMI_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const chatRequest: ChatRequest = await req.json()

    const kimiResponse = await fetch(`${kimiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kimiApiKey}`,
      },
      body: JSON.stringify(chatRequest),
    })

    if (!kimiResponse.ok) {
      const errorText = await kimiResponse.text()
      return new Response(
        JSON.stringify({ error: `Kimi API error: ${errorText}` }),
        {
          status: kimiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (chatRequest.stream) {
      return new Response(kimiResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
        },
      })
    }

    const data = await kimiResponse.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in kimi-chat function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})