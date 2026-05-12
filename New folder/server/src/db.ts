import mongoose from 'mongoose'

/** Optional MongoDB — falls back to in-memory when `MONGODB_URI` is unset. */

const playerSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true },
  wins: { type: Number, default: 0 },
  matches: { type: Number, default: 0 },
  damage: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
})

export type PlayerDoc = mongoose.InferSchemaType<typeof playerSchema>
export const PlayerModel =
  mongoose.models.Player || mongoose.model('Player', playerSchema)

let connected = false

export async function connectDb(): Promise<boolean> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('[db] MONGODB_URI not set — using in-memory stats only')
    return false
  }
  try {
    await mongoose.connect(uri)
    connected = true
    console.log('[db] MongoDB connected')
    return true
  } catch (e) {
    console.warn('[db] Mongo connect failed', e)
    return false
  }
}

export async function recordMatchEnd(
  username: string,
  won: boolean,
  damage: number,
): Promise<void> {
  if (!connected) return
  try {
    await PlayerModel.findOneAndUpdate(
      { username },
      {
        $inc: {
          wins: won ? 1 : 0,
          matches: 1,
          damage,
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    )
  } catch (e) {
    console.warn('[db] recordMatchEnd', e)
  }
}
