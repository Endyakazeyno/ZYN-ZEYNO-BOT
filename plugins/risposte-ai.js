import fetch from 'node-fetch'

export function createAIService(apiKey) {
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

  return {
    async generateReply({ messageText, authorName, chatId, authorId }) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Sei "Il Diplomatico", un assistente per un gruppo WhatsApp. 
                Il tuo stile è colto, calmo, leggermente ironico ma sempre impeccabile. 
                Non usare mai emoji volgari. Rispondi in italiano.
                Ti stai rivolgendo a ${authorName}.`
              },
              {
                role: 'user',
                content: messageText
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('[Groq Error]:', errorData)
          return null
        }

        const data = await response.json()
        return data.choices[0]?.message?.content || null

      } catch (error) {
        console.error('[AI Service Error]:', error)
        return null
      }
    }
  }
}
