import { MongoClient } from 'mongodb'
import { demoProfiles } from '../web/src/fixtures/demoProfiles.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('Set MONGODB_URI in the environment before seeding Atlas.')

const client = new MongoClient(uri)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DATABASE || 'safematch')
  const profiles = db.collection('profiles')
  const preferences = db.collection('preferences')
  await profiles.createIndex({ uid: 1 }, { unique: true })
  await profiles.createIndex({ discoverable: 1, uid: 1 })
  await preferences.createIndex({ uid: 1 }, { unique: true })
  const now = Date.now()
  const privateFields = ['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent']
  const profileRows = demoProfiles.map((profile) => {
    const data = Object.fromEntries(Object.entries(profile).filter(([key]) => !privateFields.includes(key)))
    const privateData = Object.fromEntries(Object.entries(profile).filter(([key]) => privateFields.includes(key)))
    return { profile, data, privateData }
  })
  const results = await profiles.bulkWrite(profileRows.map(({ profile, data }) => ({
    updateOne: {
      filter: { uid: profile.uid },
      update: { $set: { ...data, updatedAt: now } },
      upsert: true,
    },
  })))
  await preferences.bulkWrite(profileRows.map(({ profile, privateData }) => ({
    updateOne: {
      filter: { uid: profile.uid },
      update: { $set: { ...privateData, uid: profile.uid, updatedAt: now } },
      upsert: true,
    },
  })))
  console.log(`Seeded ${demoProfiles.length} clearly fictional profiles in ${db.databaseName}.`)
  console.log(`Inserted ${results.upsertedCount}; updated ${results.modifiedCount}. No authentication accounts were created.`)
} finally {
  await client.close()
}
