'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./utils/config')
const startIpfs = require('./utils/start-ipfs')
const customTestKeystore = require('./utils/custom-test-keystore')

const dbPath = './orbitdb/tests/customKeystore'
const ipfsPath = './orbitdb/tests/customKeystore/ipfs'

const databases = [
  {
    type: 'eventlog',
    create: (orbitdb, name, options) => orbitdb.eventlog(name, options),
    tryInsert: (db) => db.add('hello'),
    query: (db) => db.iterator({ limit: -1 }).collect(),
    getTestValue: (db) => db.iterator({ limit: -1 }).collect()[0].payload.value,
    expectedValue: 'hello',
  },
  {
    type: 'feed',
    create: (orbitdb, name, options) => orbitdb.feed(name, options),
    tryInsert: (db) => db.add('hello'),
    query: (db) => db.iterator({ limit: -1 }).collect(),
    getTestValue: (db) => db.iterator({ limit: -1 }).collect()[0].payload.value,
    expectedValue: 'hello',
  },
  {
    type: 'key-value',
    create: (orbitdb, name, options) => orbitdb.kvstore(name, options),
    tryInsert: (db) => db.set('one', 'hello'),
    query: (db) => [],
    getTestValue: (db) => db.get('one'),
    expectedValue: 'hello',
  },
  {
    type: 'documents',
    create: (orbitdb, name, options) => orbitdb.docstore(name, options),
    tryInsert: (db) => db.put({ _id: 'hello world', doc: 'all the things'}),
    query: (db) => [],
    getTestValue: (db) => db.get('hello world'),
    expectedValue: [{ _id: 'hello world', doc: 'all the things'}],
  },
  {
    type: 'counter',
    create: (orbitdb, name, options) => orbitdb.counter(name, options),
    tryInsert: (db) => db.inc(8),
    query: (db) => [],
    getTestValue: (db) => db.value,
    expectedValue: 8,
  },
]

describe('orbit-db - Using custom keystore', function() {
  this.timeout(20000)

  let ipfs, orbitdb1

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(dbPath)
    ipfs = await startIpfs(config.daemon1)
    orbitdb1 = new OrbitDB(ipfs, dbPath + '/1', {
      keystore: customTestKeystore
    })
  })

  after(async () => {
    if(orbitdb1)
      await orbitdb1.stop()

    if (ipfs)
      await ipfs.stop()
  })

  describe('allows orbit to use a custom keystore with different store types', function() {
    databases.forEach(async (database) => {
      it(database.type + ' allows custom keystore', async () => {
        const db1 = await database.create(orbitdb1, 'custom-keystore')
        await database.tryInsert(db1)

        assert.deepEqual(database.getTestValue(db1), database.expectedValue)

        await db1.close()
      })
    })
  })

  describe('allows a custom keystore to be used with different store and write permissions', function() {
    databases.forEach(async (database) => {
      it(database.type + ' allows custom keystore', async () => {
        const options = {
          // Set write access for both clients
          write: [
            orbitdb1.key.getPublic('hex')
          ],
        }

        const db1 = await database.create(orbitdb1, 'custom-keystore', options)
        await database.tryInsert(db1)

        assert.deepEqual(database.getTestValue(db1), database.expectedValue)

        await db1.close()
      })
    })
  })
})
