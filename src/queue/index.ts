import { Hono } from 'hono'
import type { QueueMessage, QueueEnv } from '../types'
import { processQueueMessage } from './handler'

const app = new Hono<{ Bindings: QueueEnv }>()

export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: QueueEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`\n📬 Queue worker received ${batch.messages.length} message(s)...`)
    
    for (const message of batch.messages) {
      try {
        console.log(`🔄 Processing message: ${message.body.type}`)
        await processQueueMessage(message.body, env, ctx)
        message.ack()
        console.log(`✅ Successfully processed: ${message.body.type}\n`)
      } catch (error) {
        console.error(`❌ Error processing queue message (${message.body.type}):`, error)
        message.retry()
      }
    }
  },

  async fetch(request: Request, env: QueueEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  }
}

app.post('/process-queue', async (c) => {
  try {
    const body = await c.req.json() as QueueMessage
    
    console.log(`\n🔧 Manual queue processing triggered: ${body.type}`)
    await processQueueMessage(body, c.env, c.executionCtx)
    
    return c.json({ 
      success: true,
      message: `Processed ${body.type}`,
      type: body.type
    })
  } catch (error) {
    console.error('Error in manual queue processing:', error)
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Health check
app.get('/health', (c) => {
  return c.text('Queue worker is running')
})

